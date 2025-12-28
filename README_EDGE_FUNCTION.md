# Edge Function 빠른 설정

## 🎯 가장 간단한 방법 (권장)

**CLI 설치 없이 Supabase 대시보드에서 직접 Edge Function을 생성할 수 있습니다:**

1. Supabase 대시보드 > Edge Functions로 이동
2. "Create a new function" 클릭
3. Function name: `download-image`
4. 아래 코드를 복사하여 붙여넣기:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, folder, fileName } = await req.json()

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`이미지 다운로드 실패: ${imageResponse.statusText}`)
    }

    const imageBlob = await imageResponse.blob()
    
    if (!imageBlob.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드 가능합니다.')
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (imageBlob.size > MAX_FILE_SIZE) {
      throw new Error('파일 크기는 10MB 이하여야 합니다.')
    }

    const fileExt = imageBlob.type.split('/')[1] || 'png'
    const finalFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const finalFolder = folder || 'diaries'
    const filePath = `${finalFolder}/${finalFileName}`

    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const { data, error } = await supabaseClient.storage
      .from('images')
      .upload(filePath, uint8Array, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageBlob.type,
      })

    if (error) {
      console.error('이미지 업로드 오류:', error)
      throw new Error(`이미지 업로드 실패: ${error.message}`)
    }

    const { data: { publicUrl } } = supabaseClient.storage
      .from('images')
      .getPublicUrl(filePath)

    return new Response(
      JSON.stringify({ publicUrl }),
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

5. "Deploy" 클릭

완료! 이제 CORS 문제 없이 이미지를 업로드할 수 있습니다.

## Edge Function 없이 사용하기

Edge Function을 배포하지 않으면, 임시 URL을 그대로 사용합니다. 
이미지는 일정 시간 후 만료될 수 있지만, 기본 기능은 작동합니다.

