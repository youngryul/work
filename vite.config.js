import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { EXCHANGE_RATE_ITEMS } from './src/constants/exchangeRates.js'
import { normalizeNaverExchangeResponse } from './src/utils/exchangeRate.js'

const NAVER_EXCHANGE_API = 'https://api.stock.naver.com/marketindex/exchange'

async function fetchFrankfurterKrw(currencyCode) {
  const response = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(currencyCode)}&to=KRW`,
    { headers: { Accept: 'application/json' } },
  )
  if (!response.ok) return null
  const data = await response.json()
  return typeof data?.rates?.KRW === 'number' ? data.rates.KRW : null
}

async function fetchOpenErApiKrw(currencyCode) {
  const response = await fetch(
    `https://open.er-api.com/v6/latest/${encodeURIComponent(currencyCode)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!response.ok) return null
  const data = await response.json()
  if (data?.result !== 'success') return null
  return typeof data?.rates?.KRW === 'number' ? data.rates.KRW : null
}

/** 로컬 dev — 환율 API (Vercel 함수와 동일 동작) */
function koreanExchangeRatesDevPlugin() {
  return {
    name: 'korean-exchange-rates-dev',
    configureServer(server) {
      server.middlewares.use('/api/korean-exchange-rates', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const url = new URL(req.url || '/', 'http://localhost')
        const codes = (url.searchParams.get('codes') || '')
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean)

        const targetCodes = codes.length > 0
          ? codes
          : EXCHANGE_RATE_ITEMS.map((item) => item.code)

        try {
          const rates = (
            await Promise.all(
              targetCodes.map(async (code) => {
                const response = await fetch(`${NAVER_EXCHANGE_API}/${code}`, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0',
                    Accept: 'application/json',
                  },
                })
                if (!response.ok) return null
                return normalizeNaverExchangeResponse(await response.json())
              }),
            )
          ).filter(Boolean)

          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({ rates }))
        } catch (error) {
          console.error('korean-exchange-rates dev error:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: '환율 조회 중 오류가 발생했습니다.' }))
        }
      })

      server.middlewares.use('/api/currency-to-krw', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const url = new URL(req.url || '/', 'http://localhost')
        const from = (url.searchParams.get('from') || '').trim().toUpperCase()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')

        if (!from || from.length !== 3) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'from 통화 코드가 필요합니다.' }))
          return
        }

        if (from === 'KRW') {
          res.end(JSON.stringify({ from, to: 'KRW', rate: 1, source: 'identity' }))
          return
        }

        try {
          let rate = await fetchFrankfurterKrw(from)
          let source = 'frankfurter'
          if (rate == null) {
            rate = await fetchOpenErApiKrw(from)
            source = 'open-er-api'
          }
          if (rate == null) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: `${from} 환율을 찾을 수 없습니다.` }))
            return
          }
          res.end(JSON.stringify({ from, to: 'KRW', rate, source }))
        } catch (error) {
          console.error('currency-to-krw dev error:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: '환율 조회 중 오류가 발생했습니다.' }))
        }
      })
    },
  }
}

// Tauri + Vite: https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), koreanExchangeRatesDevPlugin()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/korean-stock-search': {
        target: 'https://ac.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost')
          const q = url.searchParams.get('q') || ''
          const params = new URLSearchParams({
            q,
            target: 'stock',
            lang: 'ko',
            caller: 'pcweb',
          })
          return `/ac?${params.toString()}`
        },
      },
      '/api/korean-stock-quote': {
        target: 'https://m.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost')
          const code = url.searchParams.get('code') || ''
          return `/api/stock/${code}/basic`
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
