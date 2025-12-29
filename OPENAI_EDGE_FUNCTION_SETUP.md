# OpenAI 이미지 생성 Edge Function 설정 가이드

OpenAI API를 사용하여 이미지를 생성하는 Edge Function 설정 방법입니다.

## 🚀 가장 간단한 방법: 대시보드에서 직접 생성 (권장)

**이 방법이 가장 쉽고 빠릅니다!**

### 1단계: Edge Function 생성

1. Supabase 대시보드 > **Edge Functions**로 이동
2. **"Create a new function"** 클릭
3. Function name: `generate-image-huggingface` 입력 (또는 `generate-image-openai`로 변경 가능)
4. 아래 코드를 복사하여 붙여넣기:

```typescript
// Supabase Edge Function: OpenAI API를 사용하여 이미지 생성
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 이미지 생성 프롬프트 생성 상수
const BASE_STYLE = "simple black and white line art, minimalist doodle style, hand-drawn sketch, clean lines, journal illustration, white background, no colors, simple icons, sketchy style, bullet journal aesthetic, simple line drawing"
const DEFAULT_MODEL = "dall-e-3"
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

    // OpenAI API 키 확인
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 프롬프트 생성
    const prompt = createImagePrompt(diaryContent)
    
    // 사용할 모델 결정
    const modelName = model || DEFAULT_MODEL
    
    // OpenAI Images API 호출
    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          size: '1024x1024',
          quality: 'hd',
          n: 1,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || errorData.error || response.statusText
      
      // 특정 오류 메시지 처리
      if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
        return new Response(
          JSON.stringify({ error: 'API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('quota') || errorMessage.includes('Quota') || errorMessage.includes('insufficient_quota')) {
        return new Response(
          JSON.stringify({ error: 'API 할당량을 초과했습니다. OpenAI 대시보드에서 할당량을 확인해주세요.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Invalid API key')) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API 키가 유효하지 않습니다.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('does not have access to model')) {
        return new Response(
          JSON.stringify({ error: `모델 '${modelName}'에 대한 접근 권한이 없습니다. OpenAI 대시보드에서 모델 접근 권한을 확인해주세요.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `이미지 생성 실패: ${errorMessage}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    
    // OpenAI는 URL을 반환
    if (!data.data || !data.data[0] || !data.data[0].url) {
      return new Response(
        JSON.stringify({ error: '이미지 생성 실패: 응답 데이터가 올바르지 않습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imageUrl = data.data[0].url

    return new Response(
      JSON.stringify({ 
        imageUrl: imageUrl,
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
3. Name: `OPENAI_API_KEY`
4. Value: OpenAI API 키 (https://platform.openai.com/api-keys 에서 생성)
5. **"Save"** 클릭

### 3단계: 테스트

Edge Function이 정상적으로 배포되었는지 확인:

1. Edge Functions 페이지에서 함수가 표시되는지 확인
2. 일기 작성 페이지에서 이미지 생성 기능 테스트

---

## 대안: CLI를 사용한 배포 (고급)

### CLI 설치

**Windows (PowerShell 관리자 권한):**
```powershell
npm install -g supabase
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

3. Edge Function 배포:
   ```bash
   supabase functions deploy generate-image-huggingface
   ```

4. 환경 변수 설정:
   ```bash
   supabase secrets set OPENAI_API_KEY=<your-api-key>
   ```

---

## 문제 해결

### "OpenAI API 키가 설정되지 않았습니다" 오류

- Supabase 대시보드 > Settings > Edge Functions > Secrets에서 `OPENAI_API_KEY`를 설정해주세요.

### "모델에 대한 접근 권한이 없습니다" 오류

- **DALL-E 3 사용 권장**: `gpt-image-1` 모델은 조직 검증이 필요합니다. 대신 `dall-e-3` 모델을 사용하세요.
- OpenAI 대시보드(https://platform.openai.com/settings/organization)에서:
  1. 올바른 프로젝트/조직을 선택했는지 확인
  2. DALL-E 모델 사용 권한이 활성화되어 있는지 확인
  3. API 키가 올바른 프로젝트에 속해 있는지 확인

### "API 할당량을 초과했습니다" 오류

- OpenAI 대시보드에서 할당량을 확인하고 필요시 업그레이드하세요.

---

## 모델 정보

- **모델명**: `dall-e-3` (기본값)
- **제공**: OpenAI
- **해상도**: 1024x1024
- **품질**: HD (high definition)
- **대안**: `dall-e-2` (더 저렴하지만 품질이 낮음)

### 모델 선택

- **DALL-E 3** (권장): 최고 품질, `dall-e-3`
- **DALL-E 2**: 더 저렴, `dall-e-2` (quality 파라미터 지원 안 함)

---

## 완료!

이제 OpenAI API를 사용하여 이미지를 생성할 수 있습니다! 🎉

