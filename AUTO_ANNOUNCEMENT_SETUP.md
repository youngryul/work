# 자동 공지사항 설정 가이드

배포할 때마다 자동으로 공지사항을 추가하는 방법을 안내합니다.

## 🚀 빠른 시작

### 1단계: Edge Function 배포

1. Supabase 대시보드 > **Edge Functions**로 이동
2. **"Create a new function"** 클릭
3. Function name: `create-announcement` 입력
4. `supabase/functions/create-announcement/index.ts` 파일의 내용을 복사하여 붙여넣기
5. **"Deploy"** 클릭

### 2단계: 환경 변수 설정

Supabase 대시보드 > Settings > Edge Functions > Secrets로 이동하여 다음을 추가:

- `ANNOUNCEMENT_API_KEY`: 임의의 긴 문자열 (예: `your-secret-api-key-here-12345`)

⚠️ **중요**: 이 API 키를 안전하게 보관하세요. GitHub Secrets에도 동일한 값을 설정해야 합니다.

### 3단계: GitHub Secrets 설정

GitHub 저장소 > Settings > Secrets and variables > Actions로 이동하여 다음을 추가:

- `SUPABASE_URL`: Supabase 프로젝트 URL (예: `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (Settings > API에서 확인)
- `ANNOUNCEMENT_API_KEY`: 위에서 설정한 API 키

### 4단계: 완료!

이제 `main` 브랜치에 푸시하면 자동으로 공지사항이 생성됩니다!

## 📝 사용 방법

### 자동 공지사항 생성

커밋 메시지에 업데이트 내용을 작성하면 자동으로 공지사항이 생성됩니다.

#### 커밋 메시지 형식

**기본 형식** (제목 + 내용):
```bash
git commit -m "새로운 기능 추가

일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다.
향상된 사용자 경험을 제공합니다."
```

- **첫 번째 줄**: 공지사항 제목으로 사용됩니다
- **두 번째 줄부터**: 공지사항 내용으로 사용됩니다 (빈 줄은 자동으로 제외)
- 최대 2줄의 내용이 사용됩니다

**버전 지정** (선택):
```bash
git commit -m "v1.2.0: 새로운 기능 추가

일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다."
```

버전은 자동으로 추출되어 공지사항에 표시됩니다. 버전 형식:
- `v1.2.0`
- `1.2.0`
- `version 1.2.0`

버전이 없으면 현재 날짜(YYYY-MM-DD)가 자동으로 사용됩니다.

**한 줄만 작성** (제목만):
```bash
git commit -m "버그 수정"
```

내용이 없으면 자동으로 "새로운 업데이트가 배포되었습니다."가 내용으로 사용됩니다.

**공지사항 건너뛰기**:
```bash
git commit -m "[skip-announcement] 내부 리팩토링"
```

커밋 메시지에 `[skip-announcement]`가 포함되어 있으면 공지사항이 생성되지 않습니다.

### 수동 공지사항 생성

자동 생성이 필요 없을 때는 수동으로 추가할 수 있습니다:

#### 방법 1: npm 스크립트 사용

```bash
npm run announce "제목" "내용" "버전" "우선순위"
```

예시:
```bash
npm run announce "새로운 기능 추가" "일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다." "1.2.0" "10"
```

⚠️ **주의**: `.env` 파일에 다음 환경 변수가 설정되어 있어야 합니다:
- `VITE_SUPABASE_URL` 또는 `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

#### 방법 2: Edge Function 직접 호출

```bash
curl -X POST \
  "https://YOUR_PROJECT.supabase.co/functions/v1/create-announcement" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-api-key: YOUR_ANNOUNCEMENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "새로운 기능 추가",
    "content": "일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다.",
    "version": "1.2.0",
    "priority": 10
  }'
```

## 🔧 커스터마이징

### GitHub Actions 워크플로우 수정

`.github/workflows/auto-announcement.yml` 파일을 수정하여 동작을 변경할 수 있습니다:

- **트리거 브랜치 변경**: `branches: - main` 부분 수정
- **제외 경로 변경**: `paths-ignore` 부분 수정
- **버전 추출 로직 변경**: `Parse version from commit` 단계 수정

### Edge Function 수정

`supabase/functions/create-announcement/index.ts` 파일을 수정하여 추가 기능을 구현할 수 있습니다:

- 기본 우선순위 변경
- 만료일 자동 설정
- 이메일 알림 추가
- 슬랙 알림 추가

## 🐛 문제 해결

### "인증 실패" 오류

- `ANNOUNCEMENT_API_KEY`가 Supabase Secrets와 GitHub Secrets에 동일하게 설정되었는지 확인
- Edge Function이 올바르게 배포되었는지 확인

### "공지사항 생성 실패" 오류

- `announcements` 테이블이 생성되었는지 확인 (`supabase-announcements-schema.sql` 실행)
- Supabase URL과 Service Role Key가 올바른지 확인

### GitHub Actions가 실행되지 않음

- `.github/workflows/auto-announcement.yml` 파일이 올바른 위치에 있는지 확인
- GitHub Actions가 활성화되어 있는지 확인 (Settings > Actions > General)

## 📚 추가 정보

자세한 내용은 `ANNOUNCEMENT_GUIDE.md`를 참고하세요.
