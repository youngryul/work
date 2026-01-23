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
    // 인증 확인 (Authorization 헤더 또는 API 키)
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('x-api-key')
    
    // 환경 변수에서 API 키 가져오기
    const expectedApiKey = Deno.env.get('ANNOUNCEMENT_API_KEY')
    
    if (!expectedApiKey) {
      throw new Error('ANNOUNCEMENT_API_KEY 환경 변수가 설정되지 않았습니다.')
    }

    // API 키 검증
    if (apiKey !== expectedApiKey && authHeader !== `Bearer ${expectedApiKey}`) {
      return new Response(
        JSON.stringify({ error: '인증 실패' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 요청 본문 파싱
    const { title, content, version, priority = 10, expires_at = null } = await req.json()

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'title과 content는 필수입니다.' }),
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

    console.log('📝 공지사항 생성 시도:', { title, content, version, priority })

    // 공지사항 추가
    const { data, error } = await supabaseClient
      .from('announcements')
      .insert({
        title,
        content,
        version: version || null,
        is_active: true,
        priority: priority || 10,
        expires_at: expires_at || null,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ 공지사항 INSERT 오류:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    console.log('✅ 공지사항 생성 성공:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('공지사항 생성 실패:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
