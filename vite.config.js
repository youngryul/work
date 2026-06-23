import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { EXCHANGE_RATE_ITEMS } from './src/constants/exchangeRates.js'
import { normalizeNaverExchangeResponse } from './src/utils/exchangeRate.js'

const NAVER_EXCHANGE_API = 'https://api.stock.naver.com/marketindex/exchange'

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

