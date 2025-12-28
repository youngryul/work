// Supabase Edge Function: OpenAI 이미지 URL에서 이미지를 다운로드하여 Supabase Storage에 업로드
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight 요청 처리
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

    // Supabase 클라이언트 생성
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

    // 이미지 다운로드
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`이미지 다운로드 실패: ${imageResponse.statusText}`)
    }

    const imageBlob = await imageResponse.blob()
    
    // 파일 유효성 검사
    if (!imageBlob.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드 가능합니다.')
    }

    // 파일 크기 제한 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (imageBlob.size > MAX_FILE_SIZE) {
      throw new Error('파일 크기는 10MB 이하여야 합니다.')
    }

    // 파일명 생성
    const fileExt = imageBlob.type.split('/')[1] || 'png'
    const finalFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const finalFolder = folder || 'diaries'
    const filePath = `${finalFolder}/${finalFileName}`

    // ArrayBuffer로 변환
    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Supabase Storage에 업로드
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

    // 공개 URL 가져오기
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

