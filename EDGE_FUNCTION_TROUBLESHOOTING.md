# Edge Function 문제 해결 가이드

`create-announcement` Edge Function이 실행되지 않는 경우 다음을 확인하세요.

## 1. Edge Function 배포 확인

### Supabase 대시보드에서 확인
1. Supabase 대시보드 > **Edge Functions**로 이동
2. `create-announcement` 함수가 목록에 있는지 확인
3. 함수가 없다면 배포 필요

### 배포 방법
1. Supabase 대시보드 > **Edge Functions** > **"Create a new function"** 클릭
2. Function name: `create-announcement` 입력
3. `supabase/functions/create-announcement/index.ts` 파일의 내용을 복사하여 붙여넣기
4. **"Deploy"** 클릭

## 2. 환경 변수 확인

### Supabase Edge Functions Secrets 확인
1. Supabase 대시보드 > **Settings** > **Edge Functions** > **Secrets**로 이동
2. 다음 환경 변수가 설정되어 있는지 확인:
   - `ANNOUNCEMENT_API_KEY`: 임의의 긴 문자열 (예: `your-secret-api-key-here-12345`)
   - `SUPABASE_URL`: 자동으로 설정됨 (확인만)
   - `SUPABASE_SERVICE_ROLE_KEY`: 자동으로 설정됨 (확인만)

### 환경 변수 추가 방법
1. **"Add new secret"** 클릭
2. Name: `ANNOUNCEMENT_API_KEY`
3. Value: 임의의 긴 문자열 입력
4. **"Save"** 클릭

⚠️ **중요**: 이 API 키를 GitHub Secrets에도 동일하게 설정해야 합니다.

## 3. 로그 확인

### Supabase 대시보드에서 로그 확인
1. Supabase 대시보드 > **Edge Functions** > `create-announcement` 클릭
2. **"Logs"** 탭 클릭
3. 최근 실행 로그 확인:
   - `🚀 Edge Function 실행 시작` - 함수가 호출되었는지 확인
   - `✅ API 키 검증 성공` - 인증이 성공했는지 확인
   - `✅ 공지사항 생성 성공` - INSERT가 성공했는지 확인
   - `❌` 표시가 있으면 에러 메시지 확인

## 4. 수동 테스트

### curl로 테스트
```bash
curl -X POST \
  "https://YOUR_PROJECT.supabase.co/functions/v1/create-announcement" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-api-key: YOUR_ANNOUNCEMENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 공지사항",
    "content": "이것은 테스트입니다."
  }'
```

### 예상 응답
**성공 시:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "테스트 공지사항",
    "content": "이것은 테스트입니다.",
    ...
  }
}
```

**실패 시:**
```json
{
  "error": "에러 메시지"
}
```

## 5. 일반적인 오류 및 해결 방법

### "ANNOUNCEMENT_API_KEY 환경 변수가 설정되지 않았습니다"
- **원인**: Edge Functions Secrets에 `ANNOUNCEMENT_API_KEY`가 없음
- **해결**: 위의 "환경 변수 추가 방법" 참고

### "인증 실패"
- **원인**: API 키가 일치하지 않음
- **해결**: 
  1. Supabase Edge Functions Secrets의 `ANNOUNCEMENT_API_KEY` 확인
  2. 호출 시 사용한 `x-api-key` 헤더 값 확인
  3. 두 값이 정확히 일치하는지 확인

### "Supabase 환경 변수가 설정되지 않았습니다"
- **원인**: `SUPABASE_URL` 또는 `SUPABASE_SERVICE_ROLE_KEY`가 없음
- **해결**: 이 변수들은 자동으로 설정되어야 합니다. Supabase 지원팀에 문의하세요.

### "title과 content는 필수입니다"
- **원인**: 요청 본문에 `title` 또는 `content`가 없음
- **해결**: 요청 본문에 필수 필드를 포함하세요.

### "공지사항 INSERT 오류"
- **원인**: RLS 정책 문제 또는 데이터베이스 오류
- **해결**: 
  1. `supabase-announcements-edge-function-policy.sql` 파일 실행
  2. RLS 정책이 올바르게 설정되었는지 확인

## 6. GitHub Actions에서 실행되지 않는 경우

### 워크플로우 로그 확인
1. GitHub 저장소 > **Actions** 탭
2. 최근 워크플로우 실행 클릭
3. `Create announcement` 단계의 로그 확인

### 확인 사항
- `SUPABASE_URL` Secret이 올바른지 확인
- `SUPABASE_SERVICE_ROLE_KEY` Secret이 올바른지 확인
- `ANNOUNCEMENT_API_KEY` Secret이 Supabase와 일치하는지 확인

### 테스트 방법
워크플로우를 수동으로 실행:
1. GitHub 저장소 > **Actions** 탭
2. **"Auto Announcement on Deploy"** 워크플로우 선택
3. **"Run workflow"** 클릭
4. 브랜치 선택 후 **"Run workflow"** 클릭

## 7. 디버깅 팁

### 로그 레벨 확인
Edge Function 코드에 추가된 로그:
- `🚀` - 함수 실행 시작
- `✅` - 성공
- `❌` - 실패
- `📝` - 정보
- `🔐` - 인증 관련
- `🔧` - 설정 관련

### 단계별 확인
1. 함수가 호출되었는지 확인 (`🚀 Edge Function 실행 시작`)
2. 인증이 성공했는지 확인 (`✅ API 키 검증 성공`)
3. 요청 본문이 올바른지 확인 (`📥 요청 본문 파싱 성공`)
4. Supabase 클라이언트가 생성되었는지 확인 (`🔧 Supabase 환경 변수 확인`)
5. INSERT가 성공했는지 확인 (`✅ 공지사항 생성 성공`)

각 단계에서 실패하면 해당 단계의 로그를 확인하여 문제를 파악하세요.
