# 공지사항 관리 가이드

배포할 때마다 공지사항에 업데이트 내용을 추가하는 방법을 안내합니다.

## 데이터베이스 설정

먼저 공지사항 테이블을 생성해야 합니다:

1. Supabase 대시보드 > SQL Editor로 이동
2. `supabase-announcements-schema.sql` 파일의 내용을 실행

## 공지사항 추가 방법

### 방법 1: Supabase 대시보드에서 직접 추가

1. Supabase 대시보드 > Table Editor > `announcements` 테이블로 이동
2. "Insert row" 버튼 클릭
3. 다음 정보를 입력:
   - `title`: 공지사항 제목 (필수)
   - `content`: 공지사항 내용 (필수)
   - `version`: 배포 버전 (선택, 예: "1.2.3", "2024-01-15")
   - `is_active`: `true` (활성화 여부)
   - `priority`: 우선순위 (높을수록 먼저 표시, 기본값: 0)
   - `expires_at`: 만료일 (선택, NULL이면 만료되지 않음)

4. "Save" 클릭

### 방법 2: SQL로 직접 추가

Supabase SQL Editor에서 다음 쿼리를 실행:

```sql
INSERT INTO announcements (title, content, version, is_active, priority, expires_at)
VALUES (
  '업데이트 내용 제목',
  '업데이트 내용 설명',
  '1.2.3',  -- 버전 (선택)
  true,     -- 활성화
  10,       -- 우선순위 (높을수록 먼저 표시)
  NULL      -- 만료일 (NULL이면 만료되지 않음)
);
```

### 예시: 배포 업데이트 공지사항

```sql
INSERT INTO announcements (title, content, version, is_active, priority)
VALUES (
  '새로운 기능 추가',
  '일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다.',
  '1.2.0',
  true,
  10
);
```

### 예시: 임시 공지사항 (만료일 설정)

```sql
INSERT INTO announcements (title, content, version, is_active, priority, expires_at)
VALUES (
  '시스템 점검 안내',
  '2024년 1월 20일 오전 2시부터 4시까지 시스템 점검이 진행됩니다.',
  NULL,
  true,
  20,
  '2024-01-20T04:00:00Z'::timestamptz
);
```

## 공지사항 관리

### 공지사항 비활성화

더 이상 표시하지 않으려면 `is_active`를 `false`로 변경:

```sql
UPDATE announcements
SET is_active = false
WHERE id = '공지사항_ID';
```

### 공지사항 삭제

```sql
DELETE FROM announcements
WHERE id = '공지사항_ID';
```

### 모든 활성 공지사항 조회

```sql
SELECT * FROM announcements
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY priority DESC, created_at DESC;
```

## 우선순위 설정

- `priority` 값이 높을수록 먼저 표시됩니다
- 같은 우선순위인 경우 최신 공지사항이 먼저 표시됩니다
- 일반적인 공지사항: 0-9
- 중요 공지사항: 10-19
- 긴급 공지사항: 20 이상

## 사용자별 읽음 처리

사용자가 공지사항을 닫으면 자동으로 `announcement_views` 테이블에 기록되어, 해당 사용자에게는 다시 표시되지 않습니다.

특정 사용자의 읽음 기록을 초기화하려면:

```sql
DELETE FROM announcement_views
WHERE user_id = '사용자_ID' AND announcement_id = '공지사항_ID';
```

## 자동 공지사항 추가 (배포 시)

배포할 때마다 자동으로 공지사항을 추가하는 방법입니다.

### 방법 1: GitHub Actions 사용 (권장)

GitHub Actions를 사용하면 커밋 메시지에서 자동으로 공지사항을 생성합니다.

#### 설정 방법

1. **Edge Function 배포**
   - Supabase 대시보드 > Edge Functions로 이동
   - "Create a new function" 클릭
   - Function name: `create-announcement` 입력
   - `supabase/functions/create-announcement/index.ts` 파일의 내용을 복사하여 붙여넣기
   - "Deploy" 클릭

2. **환경 변수 설정**
   - Supabase 대시보드 > Settings > Edge Functions > Secrets로 이동
   - 다음 시크릿 추가:
     - `ANNOUNCEMENT_API_KEY`: 임의의 긴 문자열 (예: `your-secret-api-key-here`)

3. **GitHub Secrets 설정**
   - GitHub 저장소 > Settings > Secrets and variables > Actions로 이동
   - 다음 시크릿 추가:
     - `SUPABASE_URL`: Supabase 프로젝트 URL
     - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (Settings > API에서 확인)
     - `ANNOUNCEMENT_API_KEY`: 위에서 설정한 API 키

4. **GitHub Actions 워크플로우 활성화**
   - `.github/workflows/auto-announcement.yml` 파일이 이미 생성되어 있습니다
   - main 브랜치에 푸시하면 자동으로 실행됩니다

#### 사용 방법

커밋 메시지에 업데이트 내용을 작성하면 자동으로 공지사항이 생성됩니다:

```bash
git commit -m "새로운 기능 추가

일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다.
향상된 사용자 경험을 제공합니다."
```

**버전 지정** (선택):
```bash
git commit -m "v1.2.0: 새로운 기능 추가

일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다."
```

**공지사항 건너뛰기**:
```bash
git commit -m "[skip-announcement] 내부 리팩토링"
```

### 방법 2: 수동으로 Edge Function 호출

배포 후 수동으로 공지사항을 추가하려면:

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

### 방법 3: Vercel Deployment Hook 사용

Vercel의 배포 후크를 사용하여 자동으로 공지사항을 추가할 수 있습니다.

1. Vercel 대시보드 > 프로젝트 설정 > Git > Deploy Hooks로 이동
2. 새 후크 생성 (예: `post-deploy`)
3. 후크 URL을 사용하여 Edge Function 호출

또는 Vercel의 환경 변수를 사용하여 배포 후 자동 실행 스크립트를 만들 수 있습니다.

## 배포 워크플로우 권장사항

### 자동 공지사항 사용 시

1. **커밋 메시지 작성**: 배포할 때 의미 있는 커밋 메시지 작성
2. **자동 생성**: GitHub Actions가 자동으로 공지사항 생성
3. **일정 기간 후**: 만료일을 설정하거나 is_active = false로 변경

### 수동 공지사항 사용 시

1. **배포 전**: 공지사항을 미리 작성 (is_active = false로 설정)
2. **배포 후**: is_active = true로 변경하여 활성화
3. **일정 기간 후**: 만료일을 설정하거나 is_active = false로 변경

이렇게 하면 배포와 동시에 사용자에게 업데이트 내용을 알릴 수 있습니다.
