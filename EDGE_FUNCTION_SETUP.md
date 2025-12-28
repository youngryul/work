# Supabase Edge Function 설정 가이드

OpenAI DALL-E 이미지의 CORS 문제를 해결하기 위해 Supabase Edge Function을 사용합니다.

## 🚀 가장 간단한 방법: 대시보드에서 직접 생성 (권장)

**이 방법이 가장 쉽고 빠릅니다!**

1. Supabase 대시보드 > **Edge Functions**로 이동
2. **"Create a new function"** 클릭
3. Function name: `download-image` 입력
4. `supabase/functions/download-image/index.ts` 파일의 내용을 복사하여 붙여넣기
5. **"Deploy"** 클릭

완료! 이제 CORS 문제 없이 이미지를 업로드할 수 있습니다.

---

## 대안: CLI를 사용한 설치 (고급)

### 방법 1: npm 설치 (권한 문제 해결)

**관리자 권한으로 실행:**
1. PowerShell을 **관리자 권한으로 실행**
2. 다음 명령어 실행:
   ```powershell
   npm install -g supabase
   ```

**또는 권한 없이 설치:**
```powershell
npm install -g supabase --prefix %APPDATA%\npm
```

### 방법 2: Scoop 사용 (Windows 패키지 매니저)

1. Scoop이 설치되어 있지 않다면 먼저 설치:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```

2. Supabase CLI 설치:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

### 방법 3: 직접 바이너리 다운로드

1. [Supabase CLI 릴리스 페이지](https://github.com/supabase/cli/releases)에서 Windows용 바이너리 다운로드
2. 압축 해제 후 PATH에 추가

### CLI 설치 후 사용

1. Supabase에 로그인:
   ```bash
   supabase login
   ```

2. 프로젝트 연결:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   
   `<your-project-ref>`는 Supabase 대시보드의 프로젝트 설정에서 확인할 수 있습니다.

3. Edge Function 배포:
   ```bash
   supabase functions deploy download-image
   ```

## 4단계: 환경 변수 확인

Edge Function은 자동으로 Supabase의 환경 변수를 사용합니다:
- `SUPABASE_URL`: 자동 설정됨
- `SUPABASE_SERVICE_ROLE_KEY`: 자동 설정됨

## 대안: Edge Function 없이 사용하기

Edge Function을 배포하지 않으면, 임시 URL을 그대로 사용합니다 (만료될 수 있음).

코드에서 자동으로 폴백 처리가 되어 있어, Edge Function이 없어도 동작합니다.

## 문제 해결

### "Edge Function을 찾을 수 없습니다" 오류
- Edge Function이 배포되지 않았습니다. 위의 3단계를 따라 배포하세요.
- 또는 임시 URL을 그대로 사용하도록 폴백이 작동합니다.

### "이미지 업로드 실패" 오류
- Supabase Storage 버킷이 생성되었는지 확인하세요.
- Storage 정책이 설정되었는지 확인하세요.

