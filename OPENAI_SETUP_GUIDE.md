# OpenAI 일기 이미지 생성 기능 설정 가이드

## 1. 패키지 설치

터미널에서 다음 명령어를 실행하세요:

```bash
npm install
```

이미 `package.json`에 `openai` 패키지가 추가되어 있습니다.

## 2. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/)에 접속
2. 계정 생성 또는 로그인
3. API Keys 메뉴로 이동: https://platform.openai.com/api-keys
4. "Create new secret key" 클릭
5. 생성된 API 키를 복사 (한 번만 표시되므로 안전하게 보관)

## 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하거나 기존 파일에 다음을 추가하세요:

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**주의사항:**
- `.env` 파일은 절대 Git에 커밋하지 마세요 (이미 `.gitignore`에 포함되어 있을 것입니다)
- API 키는 외부에 노출되지 않도록 주의하세요

## 4. Supabase 데이터베이스 설정

1. Supabase 대시보드 > SQL Editor로 이동
2. `supabase-diaries-schema.sql` 파일의 내용을 복사하여 실행
3. `diaries` 테이블이 생성되었는지 확인

## 5. 사용 방법

1. 달력 화면에서 날짜를 클릭
2. 일기 내용을 입력
3. "저장" 버튼 클릭
4. AI가 자동으로 이미지를 생성합니다 (약 10-20초 소요)
5. 생성된 이미지가 달력에 표시됩니다

## 6. 비용 정보

- **DALL-E 3**: 이미지당 약 $0.04 (1024x1024, standard quality)
- **월 예상 비용**: 일일 1장 기준 약 $1.2/월
- **비용 최적화**: 
  - 같은 날짜의 일기는 이미지 재생성하지 않음
  - 이미지 재생성은 수동으로만 가능

## 7. 문제 해결

### "OpenAI API 키가 설정되지 않았습니다" 오류
- `.env` 파일에 `VITE_OPENAI_API_KEY`가 올바르게 설정되었는지 확인
- 개발 서버를 재시작하세요 (`npm run dev`)

### "API 사용량 제한에 도달했습니다" 오류
- OpenAI 계정의 사용량 제한을 확인하세요
- 잠시 후 다시 시도하세요

### "OpenAI API 크레딧이 부족합니다" 오류
- OpenAI 계정에 크레딧을 충전하세요
- https://platform.openai.com/account/billing

### 이미지가 생성되지 않아요
- 일기 내용이 비어있지 않은지 확인
- 브라우저 콘솔에서 에러 메시지 확인
- 네트워크 연결 확인

## 8. 보안 주의사항

현재 구현은 브라우저에서 직접 OpenAI API를 호출합니다. 프로덕션 환경에서는:

1. **서버 사이드로 이동 권장**: API 키를 서버에서만 사용
2. **프록시 서버 구축**: 백엔드 API를 통해 이미지 생성
3. **환경 변수 관리**: 서버 환경 변수로 API 키 관리

현재는 개발/개인 사용 목적으로 브라우저에서 직접 호출하도록 구현되어 있습니다.
