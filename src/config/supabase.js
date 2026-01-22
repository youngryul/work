import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.')
}

/**
 * Supabase 클라이언트 인스턴스 (HTTP 클라이언트)
 * 
 * 브라우저 환경에서는 Supabase HTTP 클라이언트를 사용합니다.
 * Drizzle 스키마는 타입 안전성과 마이그레이션 관리를 위해 유지됩니다.
 */
const appUrl = import.meta.env.VITE_APP_URL || 'https://work-sable-one.vercel.app/'

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    redirectTo: appUrl,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
  },
})

