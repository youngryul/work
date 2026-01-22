# Vercel 배포 환경 설정 가이드

## 배포 환경에서 발생하는 인증 오류 해결

배포 환경(`https://work-sable-one.vercel.app/`)에서 `AuthSessionMissingError` 또는 `403 Forbidden` 오류가 발생하는 경우, 다음을 확인하세요.

## 1. 환경 변수 설정 확인

Vercel 대시보드에서 다음 환경 변수가 설정되어 있는지 확인하세요:

### 필수 환경 변수

1. **VITE_SUPABASE_URL**
   - Supabase 프로젝트의 URL
   - 예: `https://xxxxx.supabase.co`

2. **VITE_SUPABASE_ANON_KEY**
   - Supabase 프로젝트의 Anon (공개) 키
   - Supabase 대시보드 > Settings > API에서 확인 가능

3. **VITE_APP_URL** (선택사항)
   - 배포된 앱의 URL
   - 예: `https://work-sable-one.vercel.app/`

### Vercel에서 환경 변수 설정 방법

1. Vercel 대시보드에 로그인
2. 프로젝트 선택
3. Settings > Environment Variables로 이동
4. 다음 변수들을 추가:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
   - `VITE_APP_URL` = `https://work-sable-one.vercel.app/` (선택사항)

### 환경 변수 확인

환경 변수를 추가한 후:
1. **재배포 필요**: 환경 변수를 추가/수정한 후에는 반드시 재배포해야 합니다.
2. Vercel 대시보드에서 "Redeploy" 버튼을 클릭하거나, Git에 푸시하면 자동으로 재배포됩니다.

## 2. Supabase RLS (Row Level Security) 정책 확인

배포 환경에서 403 오류가 발생하는 경우, Supabase의 RLS 정책을 확인하세요:

### 확인 사항

1. **RLS 정책 활성화 여부**
   - Supabase 대시보드 > Authentication > Policies에서 확인
   - 필요한 테이블에 대해 적절한 RLS 정책이 설정되어 있는지 확인

2. **인증된 사용자 접근 권한**
   - `diary_reminders` 테이블
   - `five_year_question_reminders` 테이블
   - `summary_reminders` 테이블
   - 기타 사용자 데이터 테이블

### 예시 RLS 정책

```sql
-- diary_reminders 테이블 예시
CREATE POLICY "Users can view their own diary reminders"
  ON diary_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diary reminders"
  ON diary_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diary reminders"
  ON diary_reminders FOR UPDATE
  USING (auth.uid() = user_id);
```

## 3. Supabase 인증 설정 확인

1. **Supabase 대시보드 > Authentication > URL Configuration**
   - Site URL이 올바르게 설정되어 있는지 확인
   - 예: `https://work-sable-one.vercel.app/`

2. **Redirect URLs**
   - 허용된 리디렉션 URL 목록에 배포 URL이 포함되어 있는지 확인
   - 예: `https://work-sable-one.vercel.app/**`

## 4. 브라우저 쿠키/로컬 스토리지 확인

배포 환경에서 세션이 유지되지 않는 경우:

1. 브라우저 개발자 도구 > Application > Cookies 확인
2. `sb-xxxxx-auth-token` 쿠키가 있는지 확인
3. 쿠키가 없다면 로그인을 다시 시도

## 5. 로컬과 배포 환경의 차이점

### 로컬 환경
- `.env` 파일에서 환경 변수 로드
- `localhost`에서 실행
- 개발 모드

### 배포 환경 (Vercel)
- Vercel 대시보드의 환경 변수 사용
- 프로덕션 URL에서 실행
- 빌드된 정적 파일 제공

## 6. 문제 해결 체크리스트

- [ ] Vercel에 `VITE_SUPABASE_URL` 환경 변수가 설정되어 있음
- [ ] Vercel에 `VITE_SUPABASE_ANON_KEY` 환경 변수가 설정되어 있음
- [ ] 환경 변수 추가/수정 후 재배포 완료
- [ ] Supabase RLS 정책이 올바르게 설정되어 있음
- [ ] Supabase 인증 설정에서 Site URL이 올바르게 설정되어 있음
- [ ] 브라우저에서 쿠키가 제대로 저장되고 있음

## 7. 디버깅 방법

### 콘솔에서 확인

브라우저 개발자 도구 콘솔에서 다음을 확인:

```javascript
// 환경 변수 확인 (빌드 시점에 주입됨)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('App URL:', import.meta.env.VITE_APP_URL)

// 세션 확인
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

### 네트워크 탭 확인

1. 개발자 도구 > Network 탭 열기
2. Supabase API 요청 확인
3. 403 오류가 발생하는 요청의 헤더 확인
4. Authorization 헤더가 포함되어 있는지 확인

## 8. 추가 리소스

- [Vercel 환경 변수 문서](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase 인증 문서](https://supabase.com/docs/guides/auth)
- [Supabase RLS 문서](https://supabase.com/docs/guides/auth/row-level-security)
