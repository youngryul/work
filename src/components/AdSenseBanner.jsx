import { useRef, useLayoutEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * 환경 변수에 pub-/ca-pub- 어떤 형식이 와도 처리
 * @param {string} rawId
 * @returns {string}
 */
function normalizeClientId(rawId) {
  const value = (rawId || '').trim()
  if (!value) return ''
  if (value.startsWith('ca-pub-')) return value
  if (value.startsWith('pub-')) return `ca-${value}`
  return value
}

/**
 * 애드센스 표시 단위(배너) 1개
 * .env: VITE_ADSENSE_CLIENT_ID (pub-... 또는 ca-pub-...), VITE_ADSENSE_SLOT_ID (광고 단위 슬롯)
 * 관리자가 유저별로 광고를 끈 경우 렌더하지 않음
 */
export default function AdSenseBanner({ className = '' }) {
  const { adsEnabled } = useAuth()
  const insRef = useRef(null)
  const pushedRef = useRef(false)
  const [scriptReady, setScriptReady] = useState(false)

  const clientId = normalizeClientId(import.meta.env.VITE_ADSENSE_CLIENT_ID)
  const slotId = import.meta.env.VITE_ADSENSE_SLOT_ID

  useLayoutEffect(() => {
    if (!adsEnabled || !clientId || !slotId) return

    const onReady = () => setScriptReady(true)
    const adsScriptSelector = 'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    const existingBySrc = document.querySelector(adsScriptSelector)
    if (existingBySrc) {
      if (window.adsbygoogle) {
        onReady()
      } else {
        existingBySrc.addEventListener('load', onReady)
      }
      return () => existingBySrc.removeEventListener('load', onReady)
    }

    const scriptId = `adsbygoogle-js-${clientId.replace(/[^a-zA-Z0-9]/g, '')}`
    const existing = document.getElementById(scriptId)
    if (existing) {
      if (window.adsbygoogle) {
        onReady()
      } else {
        existing.addEventListener('load', onReady)
      }
      return () => existing.removeEventListener('load', onReady)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
    script.onload = onReady
    document.head.appendChild(script)

    return () => {
      script.onload = null
    }
  }, [adsEnabled, clientId, slotId])

  useLayoutEffect(() => {
    if (!scriptReady || !adsEnabled || !clientId || !slotId) return
    if (!insRef.current || pushedRef.current) return
    pushedRef.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.warn('AdSense push:', e)
    }
  }, [scriptReady, adsEnabled, clientId, slotId])

  if (!adsEnabled || !clientId || !slotId) {
    return null
  }

  return (
    <aside
      className={`border-t border-gray-200 bg-gray-50/80 ${className}`}
      aria-label="광고"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col items-center justify-center min-h-[120px]">
        <p className="text-xs text-gray-400 mb-2 font-sans">Advertisement</p>
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', minWidth: '320px', minHeight: '100px' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  )
}
