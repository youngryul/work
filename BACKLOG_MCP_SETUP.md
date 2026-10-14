# 포실이 백로그 MCP 연결 가이드

Claude(claude.ai)와 대화하다가 "이거 포실이 백로그에 넣어줘"라고 하면 바로 할 일로 등록되게 하는 설정입니다.
서버 코드: `supabase/functions/backlog-mcp/index.ts`

## 제공 도구

| 도구 | 설명 |
|---|---|
| `add_backlog_tasks` | 백로그에 할 일 여러 개 추가 (제목, 카테고리, 메모, 예정일) |
| `list_backlog` | 현재 백로그 조회 (중복 확인용) |
| `list_categories` | 카테고리 목록 조회 |

## 1. 내 user_id 확인

Supabase 대시보드 → Authentication → Users → 내 계정의 **UID** 복사
(또는 SQL Editor: `select id from auth.users where email = '내 이메일';`)

## 2. 접근 키 만들기

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. 시크릿 등록 & 배포

```bash
supabase secrets set MCP_USER_ID=<1번 UID> MCP_ACCESS_KEY=<2번 키>
supabase functions deploy backlog-mcp --no-verify-jwt
```

> `--no-verify-jwt` 는 필수입니다. Claude는 Supabase JWT 없이 호출하고, 대신 URL의 `key` 로 인증합니다.

## 4. Claude에 커넥터 추가

claude.ai → 설정 → 커넥터 → **커스텀 커넥터 추가**

- 이름: `포실이 백로그`
- URL: `https://<프로젝트 ref>.supabase.co/functions/v1/backlog-mcp?key=<2번 키>`

그 다음 대화창의 커넥터 메뉴에서 `포실이 백로그`를 켜고 이렇게 말하면 됩니다.

> 방금 정리한 논문 로드맵 1단계를 포실이 백로그에 '공부' 카테고리로 넣어줘

## 보안 메모

- URL 안의 키가 비밀번호 역할을 합니다. 외부에 공유하지 마세요.
- 서버는 service role 키로 동작하지만 `MCP_USER_ID` 계정의 `tasks` 에만 쓰기/읽기를 합니다.
- 키가 노출되면 `supabase secrets set MCP_ACCESS_KEY=<새 키>` 로 바꾸고 커넥터 URL도 교체하세요.

## 동작 확인 (선택)

```bash
curl -X POST "https://<프로젝트 ref>.supabase.co/functions/v1/backlog-mcp?key=<키>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
