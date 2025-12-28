# 무료 AI 이미지 생성 옵션

## 1. Hugging Face Inference API (추천) ⭐

### 장점
- **완전 무료** (제한적이지만 충분함)
- Stable Diffusion 모델 사용 가능
- API 키만 있으면 바로 사용 가능
- 다양한 모델 선택 가능

### 사용 방법

1. **Hugging Face 계정 생성 및 API 키 발급**
   - [Hugging Face](https://huggingface.co) 가입
   - [Settings > Access Tokens](https://huggingface.co/settings/tokens)에서 토큰 생성
   - `.env` 파일에 추가: `VITE_HUGGINGFACE_API_KEY=your_token_here`

2. **코드 통합**
   - `src/services/freeImageService.js` 파일 생성 (아래 코드 참고)

### 비용
- **무료**: 월 30,000 요청 (충분함)
- **Pro**: $9/월 (무제한)

---

## 2. Replicate API

### 장점
- 다양한 오픈소스 모델 사용 가능
- Stable Diffusion, Flux 등
- 무료 티어 제공

### 사용 방법

1. **Replicate 계정 생성**
   - [Replicate](https://replicate.com) 가입
   - API 토큰 발급

2. **비용**
   - **무료**: 제한적 (월 $5 크레딧)
   - **Pro**: $10/월

---

## 3. Stability AI (Stable Diffusion)

### 장점
- 고품질 Stable Diffusion 모델
- API 제공

### 비용
- **무료 티어**: 제한적
- **유료**: 사용량 기반

---

## 4. Google ImageFX (API 없음)

- 웹 인터페이스만 제공
- API 없음 (코드 통합 불가)

---

## 추천: Hugging Face Inference API

가장 실용적이고 무료로 사용하기 좋은 옵션입니다.

### 구현 예시

`src/services/freeImageService.js` 파일을 생성하여 Hugging Face API를 사용할 수 있습니다.

