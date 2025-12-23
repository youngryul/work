# Supabase Storage 설정 가이드

이미지 업로드 기능을 사용하려면 Supabase Storage를 설정해야 합니다.

## 1단계: Storage 버킷 생성

1. Supabase 대시보드에 로그인합니다.
2. 왼쪽 메뉴에서 **Storage**를 클릭합니다.
3. **Create a new bucket** 버튼을 클릭합니다.
4. 다음 설정을 입력합니다:
   - **Name**: `images`
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
5. **Create bucket** 버튼을 클릭합니다.

## 2단계: Storage 정책 설정

1. Supabase 대시보드에서 **SQL Editor**를 엽니다.
2. `supabase-storage-setup.sql` 파일의 내용을 복사하여 SQL Editor에 붙여넣습니다.
3. **Run** 버튼을 클릭하여 실행합니다.

또는 수동으로 정책을 설정하려면:

### Storage > Policies에서 직접 설정:

1. **Storage** > **Policies** 메뉴로 이동합니다.
2. `images` 버킷을 선택합니다.
3. 다음 정책들을 추가합니다:

#### 읽기 정책 (Public Access)
- Policy name: `Public Access`
- Allowed operation: `SELECT`
- Policy definition: `bucket_id = 'images'`

#### 업로드 정책 (Allow uploads)
- Policy name: `Allow uploads`
- Allowed operation: `INSERT`
- Policy definition: `bucket_id = 'images'`

#### 삭제 정책 (Allow deletes)
- Policy name: `Allow deletes`
- Allowed operation: `DELETE`
- Policy definition: `bucket_id = 'images'`

## 3단계: 확인

설정이 완료되면:
1. 브라우저를 새로고침합니다 (캐시 클리어: `Ctrl+Shift+R` 또는 `Cmd+Shift+R`).
2. 프로젝트 기록 작성 화면에서 이미지를 업로드하거나 붙여넣어봅니다.

## 문제 해결

### "Bucket not found" 오류
- Storage 버킷이 생성되지 않았습니다. 1단계를 다시 확인하세요.

### "new row violates row-level security" 오류
- Storage 정책이 설정되지 않았습니다. 2단계를 다시 확인하세요.

### 브라우저 캐시 문제
- 하드 리프레시: `Ctrl+Shift+R` (Windows/Linux) 또는 `Cmd+Shift+R` (Mac)
- 또는 개발자 도구에서 "Disable cache" 옵션을 활성화하세요.
