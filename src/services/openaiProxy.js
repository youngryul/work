import OpenAI from 'openai'
import { supabase } from '../config/supabase.js'

/**
 * OpenAI 호출은 모두 Supabase Edge Function(openai-proxy)을 거칩니다.
 * 브라우저에는 OpenAI API 키를 두지 않고, 로그인한 사용자의 access token 으로 프록시를 호출합니다.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

/** OpenAI SDK baseURL 로 쓰는 프록시 주소 */
export const OPENAI_PROXY_BASE_URL = `${supabaseUrl}/functions/v1/openai-proxy/v1`

/** fetch 로 직접 호출할 때 쓰는 chat completions 주소 */
export const OPENAI_CHAT_COMPLETIONS_URL = `${OPENAI_PROXY_BASE_URL}/chat/completions`

/**
 * 프록시 인증용 토큰 (로그인 세션의 access token)
 * @returns {Promise<string>}
 */
export async function getOpenAIProxyToken() {
  const { data, error } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (error || !token) {
    throw new Error('로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.')
  }
  return token
}

/**
 * 프록시를 바라보는 OpenAI SDK 클라이언트 (토큰 만료를 피하려고 호출마다 새로 생성)
 * @returns {Promise<OpenAI>}
 */
export async function getOpenAIClient() {
  return new OpenAI({
    apiKey: await getOpenAIProxyToken(),
    baseURL: OPENAI_PROXY_BASE_URL,
    dangerouslyAllowBrowser: true,
  })
}
