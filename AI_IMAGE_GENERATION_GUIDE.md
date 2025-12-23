# AI 이미지 자동 생성 기능 구현 가이드

일기 작성 시 AI로 그림을 자동 생성하여 달력에 표시하는 기능 구현 방법입니다.

## 구현 방법

### 1. AI 이미지 생성 API 선택

#### 옵션 1: Replicate (추천)
- **장점**: 다양한 모델 사용 가능, 가격 합리적, 사용 간편
- **모델**: Stable Diffusion, Flux 등
- **가격**: 사용량 기반 (이미지당 $0.002~$0.01)
- **문서**: https://replicate.com/docs

#### 옵션 2: OpenAI DALL-E
- **장점**: 고품질, 안정적
- **단점**: 비용이 높음
- **가격**: 이미지당 $0.04~$0.08
- **문서**: https://platform.openai.com/docs/guides/images

#### 옵션 3: Stability AI
- **장점**: Stable Diffusion 전문
- **가격**: 이미지당 $0.004~$0.01
- **문서**: https://platform.stability.ai/docs

### 2. 구현 단계

#### Step 1: 패키지 설치

```bash
npm install replicate
# 또는
npm install openai
```

#### Step 2: 데이터베이스 스키마 추가

일기와 이미지 URL을 저장할 테이블이 필요합니다.

```sql
-- 일기 테이블
CREATE TABLE IF NOT EXISTS diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD 형식
  content TEXT NOT NULL,
  image_url TEXT, -- 생성된 이미지 URL
  image_prompt TEXT, -- 사용된 프롬프트
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
```

#### Step 3: AI 이미지 생성 서비스 생성

`src/services/aiImageService.js` 파일 생성:

```javascript
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.VITE_REPLICATE_API_TOKEN,
})

/**
 * 일기 내용을 기반으로 AI 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @returns {Promise<string>} 생성된 이미지 URL
 */
export async function generateDiaryImage(diaryContent) {
  try {
    // 일기 내용을 간단한 프롬프트로 변환
    const prompt = createImagePrompt(diaryContent)
    
    // Replicate에서 이미지 생성
    const output = await replicate.run(
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5fd",
      {
        input: {
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted",
          width: 512,
          height: 512,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50
        }
      }
    )
    
    return output[0] // 이미지 URL 반환
  } catch (error) {
    console.error('이미지 생성 오류:', error)
    throw error
  }
}

/**
 * 일기 내용을 이미지 생성 프롬프트로 변환
 * @param {string} content - 일기 내용
 * @returns {string} 프롬프트
 */
function createImagePrompt(content) {
  // 일기 내용을 간단하고 시각적인 프롬프트로 변환
  // 예: "오늘 책을 읽었다" -> "simple line drawing of a person reading a book, minimalist, black and white, doodle style"
  
  const style = "simple line drawing, minimalist, black and white, doodle style, hand-drawn sketch"
  
  // 키워드 추출 및 프롬프트 생성 (간단한 예시)
  let prompt = content
    .substring(0, 100) // 처음 100자만 사용
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
    .trim()
  
  return `${prompt}, ${style}`
}
```

#### Step 4: 일기 서비스 생성

`src/services/diaryService.js` 파일 생성:

```javascript
import { supabase } from '../config/supabase.js'
import { generateDiaryImage } from './aiImageService.js'
import { uploadImage } from './imageService.js'

/**
 * 일기 저장 (이미지 자동 생성 포함)
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {string} content - 일기 내용
 * @returns {Promise<Object>} 저장된 일기
 */
export async function saveDiary(date, content) {
  try {
    // 1. AI 이미지 생성
    const imageUrl = await generateDiaryImage(content)
    
    // 2. 이미지를 Supabase Storage에 업로드 (선택사항)
    // const uploadedUrl = await uploadImageFromUrl(imageUrl, `diaries/${date}.png`)
    
    // 3. 일기 저장
    const { data, error } = await supabase
      .from('diaries')
      .upsert({
        date,
        content,
        image_url: imageUrl,
        image_prompt: createImagePrompt(content),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'date'
      })
      .select()
      .single()
    
    if (error) throw error
    
    return data
  } catch (error) {
    console.error('일기 저장 오류:', error)
    throw error
  }
}

/**
 * 날짜별 일기 조회
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} 일기 데이터
 */
export async function getDiaryByDate(date) {
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', date)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  
  return data
}

/**
 * 월별 일기 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array>} 일기 목록
 */
export async function getDiariesByMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`
  
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  
  if (error) throw error
  
  return data || []
}
```

#### Step 5: 달력 컴포넌트 수정

`Calendar.jsx`에서 일기 이미지를 표시하도록 수정:

```javascript
import { getDiariesByMonth } from '../services/diaryService.js'

// 달력 날짜 셀에 이미지 표시
{count > 0 && (
  <>
    <span className="text-lg font-bold mt-auto mx-auto">
      {count}개
    </span>
    {/* 일기 이미지 표시 */}
    {diaryImage && (
      <img 
        src={diaryImage} 
        alt="일기 이미지"
        className="w-full h-full object-cover rounded mt-1"
      />
    )}
  </>
)}
```

### 3. 환경 변수 설정

`.env` 파일에 API 키 추가:

```
VITE_REPLICATE_API_TOKEN=your_replicate_api_token
```

### 4. 비용 최적화

1. **캐싱**: 같은 날짜의 일기는 이미지 재생성하지 않음
2. **비동기 처리**: 이미지 생성은 백그라운드에서 처리
3. **프롬프트 최적화**: 짧고 명확한 프롬프트로 생성 시간 단축
4. **이미지 크기**: 작은 크기(512x512)로 시작

### 5. 대안: 클라이언트 사이드 생성

브라우저에서 직접 생성하려면:
- **TensorFlow.js** + **Stable Diffusion Web**
- 더 복잡하지만 API 비용 없음
- 초기 로딩 시간이 길 수 있음

## 구현 예시 코드

전체 구현 예시는 별도 파일로 제공됩니다.
