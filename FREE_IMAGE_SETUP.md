# 무료 이미지 생성 설정 가이드

## Hugging Face Inference API 사용하기 (완전 무료)

### 1단계: Hugging Face 계정 생성

1. [Hugging Face](https://huggingface.co)에 가입
2. 이메일 인증 완료

### 2단계: API 토큰 생성

1. [Settings > Access Tokens](https://huggingface.co/settings/tokens)로 이동
2. "New token" 클릭
3. 토큰 이름 입력 (예: "diary-image-generator")
4. "Read" 권한 선택
5. "Generate a token" 클릭
6. 생성된 토큰 복사 (한 번만 표시됨!)

### 3단계: 환경 변수 설정

`.env` 파일에 추가:
```env
VITE_HUGGINGFACE_API_KEY=your_token_here
```

### 4단계: 코드 수정

`src/services/diaryService.js` 파일 수정:

```javascript
// 2번째 줄 수정
import { generateDiaryImage } from './aiImageService.js'
// 아래로 변경:
import { generateDiaryImageFree } from './freeImageService.js'

// 28번째 줄 수정
const { imageUrl: generatedUrl, prompt } = await generateDiaryImage(content)
// 아래로 변경:
const { imageUrl: generatedUrl, prompt } = await generateDiaryImageFree(content)
```

### 5단계: 재시작

개발 서버를 재시작하세요:
```bash
npm run dev
```

## 무료 할당량

- **무료**: 월 30,000 요청 (충분함!)
- 하루 약 1,000장 생성 가능
- Pro 업그레이드: $9/월 (무제한)

## 모델 변경

`src/services/freeImageService.js` 파일에서 모델을 변경할 수 있습니다:

```javascript
// 30번째 줄
const model = "stabilityai/stable-diffusion-xl-base-1.0" // 현재 모델

// 다른 모델 옵션:
// "runwayml/stable-diffusion-v1-5" - 더 빠름
// "stabilityai/stable-diffusion-2-1" - 중간 품질
// "stabilityai/stable-diffusion-xl-base-1.0" - 고품질 (현재)
```

## 장단점 비교

### Hugging Face (무료)
- ✅ 완전 무료
- ✅ 월 30,000 요청 (충분함)
- ✅ 다양한 모델 선택 가능
- ❌ 첫 요청 시 모델 로딩 시간 (30초 정도)
- ❌ 품질이 DALL-E보다 약간 낮을 수 있음

### OpenAI DALL-E 2 (유료)
- ✅ 빠른 응답
- ✅ 높은 품질
- ❌ 이미지당 $0.02 (약 26원)
- ❌ 접근 권한 필요

## 문제 해결

### "model is currently loading" 오류
- 모델이 첫 로딩 중입니다
- 30초~1분 후 다시 시도하세요
- 한 번 로드되면 빠르게 작동합니다

### "quota exceeded" 오류
- 무료 할당량을 초과했습니다
- 다음 달까지 기다리거나 Pro로 업그레이드하세요

### 이미지가 생성되지 않음
- API 키가 올바른지 확인
- 네트워크 연결 확인
- 브라우저 콘솔에서 오류 확인

