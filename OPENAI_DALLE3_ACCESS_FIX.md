# DALL-E 모델 접근 권한 오류 해결 가이드

## 오류 메시지
```
403 Project does not have access to model dall-e-2
또는
403 Project does not have access to model dall-e-3
```

## 원인
OpenAI API 키가 속한 프로젝트/조직에 DALL-E 모델 사용 권한이 없습니다.

## 해결 방법

### 1단계: OpenAI 대시보드 접속
1. [OpenAI Platform](https://platform.openai.com)에 로그인
2. 우측 상단의 **조직/프로젝트 선택기** 확인

### 2단계: 올바른 프로젝트/조직 선택
1. 조직 선택기에서 **DALL-E 3 접근 권한이 있는 조직** 선택
2. 또는 **새 프로젝트 생성** (DALL-E 3 권한이 있는 조직에서)

### 3단계: API 키 확인
1. [API Keys 페이지](https://platform.openai.com/api-keys)로 이동
2. 현재 사용 중인 API 키가 **올바른 프로젝트/조직**에 속해 있는지 확인
3. 필요시 새 API 키 생성:
   - "Create new secret key" 클릭
   - 키 이름 입력 (예: "DALL-E 3 Access")
   - 생성된 키를 `.env` 파일의 `VITE_OPENAI_API_KEY`에 업데이트

### 4단계: 모델 접근 권한 확인
1. [Settings > Organization](https://platform.openai.com/settings/organization)로 이동
2. "Model access" 섹션 확인
3. DALL-E 3이 활성화되어 있는지 확인
4. 비활성화되어 있다면 활성화 요청

### 5단계: 결제 정보 확인
1. [Billing](https://platform.openai.com/account/billing) 페이지 확인
2. 결제 방법이 등록되어 있는지 확인
3. DALL-E 3 사용을 위한 충분한 크레딧이 있는지 확인

## 대안: DALL-E 2 사용

DALL-E 3에 접근할 수 없는 경우, 임시로 DALL-E 2를 사용할 수 있습니다:

`src/services/aiImageService.js` 파일에서:
```javascript
// 54번째 줄 수정
model: 'dall-e-2', // dall-e-3 대신 dall-e-2 사용
```

**참고:** DALL-E 2는 DALL-E 3보다 낮은 품질이지만 더 넓은 접근 권한을 제공합니다.

## 확인 사항 체크리스트

- [ ] 올바른 조직/프로젝트 선택됨
- [ ] API 키가 올바른 프로젝트에 속함
- [ ] DALL-E 3 모델 접근 권한 활성화됨
- [ ] 결제 정보 등록됨
- [ ] 충분한 크레딧 있음

## 추가 도움말

- [OpenAI API 문서](https://platform.openai.com/docs)
- [OpenAI 커뮤니티 포럼](https://community.openai.com)
- [OpenAI 지원](https://help.openai.com)

