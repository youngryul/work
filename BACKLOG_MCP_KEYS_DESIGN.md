# 포실이 MCP A안 · 사용자별 연결 키 설계

포실이 사용자가 각자 설정 화면에서 연결 키를 발급받아 Claude(claude.ai, Claude Code)에 자기 포실이를 연결하는 방식이다.
OAuth(B안)는 이 다음 단계에서 진행한다.

- 서버 코드: `supabase/functions/backlog-mcp/index.ts`
- DB 마이그레이션: `supabase-mcp-connections.sql`
- 기존 단일 키 방식 안내: `BACKLOG_MCP_SETUP.md` (A안 11에서 교체)

## 결정 사항

| 항목 | 결정 |
|---|---|
| 키 발급 방식 | DB 함수(RPC) `issue_mcp_key` — 로그인 사용자(`auth.uid()`) 기준, 별도 Edge Function 배포 없음 |
| 사용자당 키 개수 | 이름을 붙여 최대 5개 (폐기한 키는 개수에서 제외) |
| 키 원문 | 발급 직후 한 번만 보여준다. DB에는 SHA-256 해시와 앞부분(표시용)만 저장 |
| 만료 | 없음. 사용자가 직접 폐기하고, 마지막 사용 시각을 보여준다 |
| 공개 대상 | 로그인한 모든 사용자 (처음엔 슈퍼유저·관리자만 열었다가 2026-10-27 전체 공개로 변경) |
| 사용 한도 | 키 하나당 도구 호출 분당 30회, 할 일 추가 하루 300개 (한국 시간 기준) |
| 허용 도구 | 기존 도구 전체 (추가·조회·메모 수정). 읽기 전용 키는 나중에 |

## 키 형식

```
psl_<64자리 hex>   (32바이트 랜덤)
```

- 접두사 `psl_`로 포실이 키임을 알아볼 수 있게 한다.
- 표시용 앞부분(`key_prefix`)은 `psl_` + 8자리 (예: `psl_1a2b3c4d`).
- 서버는 받은 키를 SHA-256으로 해시해서 `key_hash`로 찾는다. 원문은 어디에도 저장하지 않는다.

## 데이터 구조

### `mcp_connections`

| 컬럼 | 설명 |
|---|---|
| `id` | uuid |
| `user_id` | 키 주인 |
| `label` | 키 이름 (예: "claude.ai", "회사 노트북 Claude Code") |
| `key_hash` | 키 원문의 SHA-256 hex (unique) |
| `key_prefix` | 표시용 앞부분 |
| `created_at` | 발급 시각 |
| `last_used_at` | 마지막 사용 시각 (서버가 5분에 한 번만 갱신) |
| `revoked_at` | 폐기 시각 (null이면 사용 중) |

RLS: 본인 행 조회만 허용. 발급·폐기는 DB 함수로만 한다 (클라이언트가 해시를 직접 넣지 못하게).

### `mcp_rate_counters`

| 컬럼 | 설명 |
|---|---|
| `connection_id` + `bucket` | 기본 키. bucket 예: `m:2026-10-27T03:41` (분), `d:2026-10-27:tasks` (일) |
| `count` | 누적 값 |
| `updated_at` | 오래된 행 정리용 (2일 지난 행 삭제) |

RLS를 켜고 정책은 두지 않는다. 서버(service role)가 `mcp_consume` 함수로만 쓴다.

## DB 함수

| 함수 | 호출자 | 동작 |
|---|---|---|
| `issue_mcp_key(p_label)` | 로그인 사용자 | 개수 확인 → 키 생성 → 해시 저장 → 원문 키 한 번 반환 |
| `revoke_mcp_key(p_id)` | 로그인 사용자 | 본인 키의 `revoked_at` 설정 |
| `mcp_consume(p_connection_id, p_bucket, p_amount, p_limit)` | 서버(service role) | 한도 안이면 더하고 `true`, 넘으면 그대로 두고 `false` |

## 서버 인증 흐름 (backlog-mcp)

1. 키 읽기: `Authorization: Bearer psl_...` 헤더 → 없으면 URL `?key=`.
   - claude.ai 커스텀 커넥터는 헤더를 넣을 수 없어 URL 방식, Claude Code는 헤더 방식을 권장한다.
2. `psl_` 키면 해시로 `mcp_connections`를 찾는다. 없거나 폐기됐으면 403.
3. 전환 기간 동안 기존 시크릿 `MCP_ACCESS_KEY`와 같으면 `MCP_USER_ID`로 동작한다 (한도 없음).
   A안 11에서 내 커넥터를 새 키로 바꾼 뒤 두 시크릿을 지우면 이 경로는 꺼진다.
4. 키 불일치는 401이 아니라 403으로 답한다. 401을 주면 Claude가 OAuth 로그인 절차를 시작한다.
5. 찾은 `user_id`로만 조회·쓰기를 한다. 서버는 아직 service role로 동작하므로 모든 쿼리에 `user_id` 조건을 넣는다
   (RLS로 바꾸는 것은 B안 11).

## 사용 한도

- `tools/call` 한 번마다 분 단위 카운터를 1 올린다. 30을 넘으면 도구 오류(`isError`)로
  "잠시 후 다시 시도" 메시지를 돌려준다. `initialize`, `tools/list`는 세지 않는다.
- `add_backlog_tasks`는 넣을 개수만큼 일 단위 카운터를 올린다. 하루 300개를 넘으면 추가하지 않는다.
- HTTP 429 대신 도구 오류로 돌려주는 이유: Claude가 원인을 읽고 사용자에게 설명할 수 있다.

## 남은 단계

- A안 07 · 웹 설정 'Claude 연결' 화면 (발급·이름·마지막 사용·폐기, 원문 한 번 표시)
- A안 08 · 연결 가이드, 09 · 개인정보 고지, 10 · 테스트, 11 · 배포와 키 교체, 12 · 공지
