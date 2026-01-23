import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Edge Function 실행 시작:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  })

  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight 요청 처리')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 인증 확인 (Authorization 헤더 또는 API 키)
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('x-api-key')
    
    console.log('🔐 인증 확인:', {
      hasAuthHeader: !!authHeader,
      hasApiKey: !!apiKey,
      authHeaderPrefix: authHeader?.substring(0, 20),
    })
    
    // 환경 변수에서 API 키 가져오기
    const expectedApiKey = Deno.env.get('ANNOUNCEMENT_API_KEY')
    
    if (!expectedApiKey) {
      console.error('❌ ANNOUNCEMENT_API_KEY 환경 변수가 설정되지 않았습니다.')
      throw new Error('ANNOUNCEMENT_API_KEY 환경 변수가 설정되지 않았습니다.')
    }

    console.log('✅ ANNOUNCEMENT_API_KEY 환경 변수 확인됨')

    // API 키 검증
    const isValidAuth = apiKey === expectedApiKey || authHeader === `Bearer ${expectedApiKey}`
    
    if (!isValidAuth) {
      console.error('❌ API 키 검증 실패:', {
        providedApiKey: apiKey ? '있음' : '없음',
        providedAuthHeader: authHeader ? '있음' : '없음',
      })
      return new Response(
        JSON.stringify({ error: '인증 실패: 올바른 API 키를 제공해주세요.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ API 키 검증 성공')

    // 요청 본문 파싱
    let requestBody
    try {
      requestBody = await req.json()
      console.log('📥 요청 본문 파싱 성공:', { 
        hasTitle: !!requestBody.title, 
        hasContent: !!requestBody.content,
        titleLength: requestBody.title?.length || 0,
        contentLength: requestBody.content?.length || 0,
      })
    } catch (error) {
      console.error('❌ 요청 본문 파싱 실패:', error)
      return new Response(
        JSON.stringify({ error: '요청 본문을 파싱할 수 없습니다. JSON 형식이 올바른지 확인해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { title, content, version, priority = 10, expires_at = null } = requestBody

    if (!title || !content) {
      console.error('❌ 필수 필드 누락:', { hasTitle: !!title, hasContent: !!content })
      return new Response(
        JSON.stringify({ error: 'title과 content는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    console.log('🔧 Supabase 환경 변수 확인:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl.length,
      serviceKeyLength: supabaseServiceKey.length,
    })
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase 환경 변수 누락:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      })
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.')
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
    console.error('❌ 공지사항 생성 실패:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
    })
    
    return new Response(
      JSON.stringify({ 
        error: error.message || '알 수 없는 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
