# Supabase Storage 설정 가이드

이미지 업로드 기능을 사용하려면 Supabase Storage를 설정해야 합니다.

## 1단계: Storage 버킷 생성

1. Supabase 대시보드에 로그인합니다.
2. 왼쪽 메뉴에서 **Storage**를 클릭합니다.
3. **Create a new bucket** 버튼을 클릭합니다.
4. 다음 정보를 입력합니다:
   - **Name**: `images`
   - **Public bucket**: ✅ 체크 (공개 접근 허용)
5. **Create bucket** 버튼을 클릭합니다.

## 2단계: Storage 정책 설정

1. Supabase 대시보드에서 **SQL Editor**를 엽니다.
2. `supabase-storage-setup.sql` 파일의 내용을 복사하여 SQL Editor에 붙여넣습니다.
3. **Run** 버튼을 클릭하여 실행합니다.

또는 수동으로 다음 정책을 생성할 수 있습니다:

### Storage > Policies에서 수동 생성

1. Storage > Policies로 이동합니다.
2. `images` 버킷에 대해 다음 정책을 생성합니다:

**정책 1: Public Access (읽기)**
- Policy name: `Public Access`
- Allowed operation: `SELECT`
- Policy definition:
  ```sql
  bucket_id = 'images'
  ```

**정책 2: Allow uploads (업로드)**
- Policy name: `Allow uploads`
- Allowed operation: `INSERT`
- Policy definition:
  ```sql
  bucket_id = 'images'
  ```

**정책 3: Allow deletes (삭제)**
- Policy name: `Allow deletes`
- Allowed operation: `DELETE`
- Policy definition:
  ```sql
  bucket_id = 'images'
  ```

## 확인

설정이 완료되면 애플리케이션에서 이미지를 업로드하거나 붙여넣을 수 있습니다.

## 문제 해결

### "Storage 버킷이 생성되지 않았습니다" 오류
- Supabase 대시보드에서 `images` 버킷이 생성되었는지 확인하세요.
- 버킷 이름이 정확히 `images`인지 확인하세요.

### "Storage 정책이 설정되지 않았습니다" 오류
- Storage > Policies에서 `images` 버킷에 정책이 설정되었는지 확인하세요.
- `supabase-storage-setup.sql` 파일을 SQL Editor에서 실행했는지 확인하세요.
