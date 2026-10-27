# 포실이 백로그 MCP 연결 가이드

Claude(claude.ai, Claude Code)와 대화하다가 "이거 포실이 백로그에 넣어줘"라고 하면 바로 할 일로 등록되게 하는 설정입니다.
사용자마다 포실이 **설정 › Claude 연결**에서 연결 키를 발급받아 씁니다.

- 서버 코드: `supabase/functions/backlog-mcp/index.ts`
- 설계: `BACKLOG_MCP_KEYS_DESIGN.md`
- DB 마이그레이션: `supabase-mcp-connections.sql`
- 연결 테스트: `scripts/test-mcp-connection.mjs`

## 제공 도구

| 도구 | 설명 |
|---|---|
| `add_backlog_tasks` | 백로그에 할 일 여러 개 추가 (제목, 카테고리, 메모, 예정일) |
| `list_backlog` | 현재 백로그 조회 (중복 확인용) |
| `list_today_tasks` | 오늘 할 일 조회 (메모 수정할 id 찾기용) |
| `update_task_memo` | 할 일 메모 덧붙이기·바꾸기 |
| `list_categories` | 카테고리 목록 조회 |

## 사용자 연결 방법

1. 포실이 웹 **설정 › Claude 연결**에서 키 이름을 적고 **새 키 발급**
2. 한 번만 보이는 값 중 하나를 등록
   - claude.ai: 설정 › 커넥터 › 커스텀 커넥터 추가 › 원격 MCP 서버 URL에 **커넥터 URL** 붙여 넣기
   - Claude Code: **Claude Code 명령어**를 터미널에서 실행 (키는 `Authorization` 헤더로 저장됨)
3. 자세한 안내는 같은 화면의 **❓ 연결 방법 보기**

## 서버 배포 (관리자)

1. SQL Editor에서 `supabase-mcp-connections.sql` 실행
2. 함수 배포 (CLI를 설치하지 않았으면 `npx supabase` 사용)

```bash
npx supabase functions deploy backlog-mcp --no-verify-jwt --project-ref dxerloskhvgmglxogtnw
```

> `--no-verify-jwt` 는 필수입니다. Claude는 Supabase JWT 없이 호출하고, 대신 연결 키로 인증합니다.
> 대시보드에서 배포했다면 함수 설정의 JWT 검증이 꺼져 있는지 확인하세요.

## 기존 단일 키에서 옮기기 (A안 11, 한 번만)

예전 방식(`MCP_ACCESS_KEY` + `MCP_USER_ID` 시크릿)은 전환 기간 동안만 동작합니다.

1. 설정 › Claude 연결에서 내 키 발급 (claude.ai용, Claude Code용 따로)
2. claude.ai 커넥터의 URL을 새 커넥터 URL로 교체 (기존 커넥터를 지우고 새로 추가해도 됨)
3. Claude Code에 등록한 예전 서버가 있으면 지우고 새 명령어로 다시 등록
4. 새 키로 도구가 동작하는지 확인 (마지막 사용 시각이 찍히는지 설정 화면에서 확인)
5. 예전 시크릿 삭제 → 예전 키는 바로 403

```bash
npx supabase secrets unset MCP_ACCESS_KEY MCP_USER_ID --project-ref dxerloskhvgmglxogtnw
```

## 보안 메모

- 연결 키는 비밀번호 역할을 합니다. DB에는 SHA-256 해시만 저장되고 원문은 발급 화면에서 한 번만 보입니다.
- 서버는 service role 키로 동작하지만 키 주인(`user_id`)의 `tasks`·`categories`·`user_preferences`만 읽고 씁니다.
  (사용자 토큰과 RLS로 바꾸는 것은 OAuth B안에서 진행)
- 키 하나당 도구 호출 분당 30회, 할 일 추가 하루 300개(한국 시간 기준) 한도가 있습니다.
- 키가 노출되면 설정 › Claude 연결에서 폐기하고 새로 발급하세요.

## 동작 확인

계정 두 개에서 키를 하나씩 발급한 뒤 (PowerShell):

```powershell
$env:MCP_KEY_A="psl_..."; $env:MCP_KEY_B="psl_..."; node scripts/test-mcp-connection.mjs --write --rate-limit
```

직접 호출해 보려면:

```bash
curl -X POST "https://dxerloskhvgmglxogtnw.supabase.co/functions/v1/backlog-mcp" \
  -H "Authorization: Bearer psl_..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
