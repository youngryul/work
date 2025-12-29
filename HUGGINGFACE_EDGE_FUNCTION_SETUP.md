# Hugging Face 이미지 생성 Edge Function 설정 가이드

Hugging Face API의 CORS 문제를 해결하기 위해 Supabase Edge Function을 사용합니다.

## 🚀 가장 간단한 방법: 대시보드에서 직접 생성 (권장)

**이 방법이 가장 쉽고 빠릅니다!**

### 1단계: Edge Function 생성

1. Supabase 대시보드 > **Edge Functions**로 이동
2. **"Create a new function"** 클릭
3. Function name: `generate-image-huggingface` 입력
4. 아래 코드를 복사하여 붙여넣기:

```typescript
// Supabase Edge Function: Hugging Face Inference API를 사용하여 이미지 생성
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 이미지 생성 프롬프트 생성 상수
const BASE_STYLE = "simple black and white line art, minimalist doodle style, hand-drawn sketch, clean lines, journal illustration, white background, no colors, simple icons, sketchy style, bullet journal aesthetic, simple line drawing"
const DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
const MAX_PROMPT_LENGTH = 300
const MAX_KEYWORDS = 15

/**
 * 일기 내용에서 주요 키워드 추출
 */
function extractKeywords(content: string): string {
  const text = content
    .substring(0, MAX_PROMPT_LENGTH)
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1)
  
  const keywords = text
    .slice(0, MAX_KEYWORDS)
    .join(', ')
  
  return keywords
}

/**
 * 일기 내용을 이미지 생성 프롬프트로 변환
 */
function createImagePrompt(content: string): string {
  const keywords = extractKeywords(content)
  
  return `Simple doodle illustration of: ${keywords}. ${BASE_STYLE}`
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { diaryContent, model } = await req.json()

    if (!diaryContent) {
      return new Response(
        JSON.stringify({ error: 'diaryContent가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Hugging Face API 키 확인
    const apiKey = Deno.env.get('HUGGINGFACE_API_KEY')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Hugging Face API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 프롬프트 생성
    const prompt = createImagePrompt(diaryContent)
    
    // 사용할 모델 결정
    const modelName = model || DEFAULT_MODEL
    
    // Hugging Face Inference API 호출 (새로운 엔드포인트 사용)
    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${modelName}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 35,
            guidance_scale: 7.5,
            width: 1024,
            height: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || response.statusText
      
      // 특정 오류 메시지 처리
      if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
        return new Response(
          JSON.stringify({ error: 'API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
        return new Response(
          JSON.stringify({ error: '무료 할당량을 초과했습니다. Hugging Face Pro로 업그레이드하거나 내일 다시 시도해주세요.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('model is currently loading')) {
        return new Response(
          JSON.stringify({ error: '모델이 로딩 중입니다. 30초 후 다시 시도해주세요.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `이미지 생성 실패: ${errorMessage}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 이미지 데이터를 Blob으로 받기
    const imageBlob = await response.blob()
    
    // Blob을 Base64로 변환 (Deno 환경)
    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Deno에서 Base64 인코딩
    let binaryString = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i])
    }
    const base64 = btoa(binaryString)
    const dataUrl = `data:${imageBlob.type};base64,${base64}`

    return new Response(
      JSON.stringify({ 
        imageUrl: dataUrl,
        prompt: prompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('에러:', error)
    return new Response(
      JSON.stringify({ error: error.message || '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

5. **"Deploy"** 클릭

### 2단계: 환경 변수 설정

1. Supabase 대시보드 > **Settings** > **Edge Functions** > **Secrets**로 이동
2. **"Add new secret"** 클릭
3. Name: `HUGGINGFACE_API_KEY`
4. Value: Hugging Face API 키 (https://huggingface.co/settings/tokens 에서 생성)
5. **"Save"** 클릭

### 3단계: 테스트

Edge Function이 정상적으로 배포되었는지 확인:

1. Edge Functions 페이지에서 `generate-image-huggingface` 함수가 표시되는지 확인
2. 일기 작성 페이지에서 이미지 생성 기능 테스트

---

## 대안: CLI를 사용한 배포 (고급)

### CLI 설치

**Windows (PowerShell 관리자 권한):**
```powershell
npm install -g supabase
```

또는 권한 없이:
```powershell
npm install -g supabase --prefix %APPDATA%\npm
```

### CLI 사용

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
   supabase functions deploy generate-image-huggingface
   ```

4. 환경 변수 설정:
   ```bash
   supabase secrets set HUGGINGFACE_API_KEY=<your-api-key>
   ```

---

## 문제 해결

### "Edge Function 호출 실패" 오류

1. **Edge Function이 배포되었는지 확인**
   - Supabase 대시보드 > Edge Functions에서 `generate-image-huggingface` 함수가 있는지 확인
   - 없다면 위의 1단계를 따라 생성

2. **환경 변수가 설정되었는지 확인**
   - Settings > Edge Functions > Secrets에서 `HUGGINGFACE_API_KEY`가 있는지 확인
   - 없다면 위의 2단계를 따라 설정

3. **함수 이름 확인**
   - 함수 이름이 정확히 `generate-image-huggingface`인지 확인 (대소문자 구분)

4. **Supabase URL 확인**
   - `.env` 파일에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 올바르게 설정되었는지 확인

### "Hugging Face API 키가 설정되지 않았습니다" 오류

- Supabase 대시보드 > Settings > Edge Functions > Secrets에서 `HUGGINGFACE_API_KEY`를 설정해주세요.

### "API 사용량 제한" 오류

- Hugging Face 무료 계정은 사용량 제한이 있습니다. 잠시 후 다시 시도하거나 Hugging Face Pro로 업그레이드하세요.

---

## 완료!

이제 CORS 문제 없이 Hugging Face API를 사용하여 이미지를 생성할 수 있습니다! 🎉

