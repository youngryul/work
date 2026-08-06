import { useEffect, useState } from 'react'
import { MENU_RECOMMEND_TOKEN_COST } from '../constants/aiTokenSettings.js'
import { recommendMenusFromFridge } from '../services/menuRecommendService.js'

/**
 * 냉장고 재료 기반 메뉴 추천 모달
 * @param {{
 *   open: boolean,
 *   ingredients: Array,
 *   onClose: () => void,
 * }} props
 */
export default function FridgeMenuRecommendModal({ open, ingredients = [], onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [menus, setMenus] = useState([])
  const [remainingBalance, setRemainingBalance] = useState(null)

  useEffect(() => {
    if (!open) {
      setLoading(false)
      setError('')
      setMenus([])
      setRemainingBalance(null)
      return
    }

    let cancelled = false

    const run = async () => {
      if (!ingredients.length) {
        setError('보관중 재료가 없습니다. 재료를 먼저 등록해 주세요.')
        return
      }

      setLoading(true)
      setError('')
      setMenus([])
      try {
        const result = await recommendMenusFromFridge(ingredients)
        if (cancelled) return
        setMenus(result.menus)
        setRemainingBalance(result.remainingBalance)
      } catch (err) {
        if (cancelled) return
        setError(err?.message || '메뉴 추천에 실패했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // open 시에만 1회 실행 (ingredients는 열 시점 스냅샷)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-green-200 bg-green-50 px-5 py-4">
          <div>
            <h2 className="font-handwriting text-2xl text-gray-800">메뉴 추천</h2>
            <p className="mt-0.5 font-sans text-sm text-gray-500">
              보관중 재료 기준 · {MENU_RECOMMEND_TOKEN_COST}토큰
              {remainingBalance != null && (
                <span className="ml-2 text-green-700">남은 토큰 {remainingBalance}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-2xl font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="py-16 text-center font-sans text-gray-500">
              냉장고 재료로 메뉴를 고르는 중...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && menus.length > 0 && (
            <ul className="space-y-4">
              {menus.map((menu) => (
                <li
                  key={menu.id}
                  className="rounded-xl border-2 border-green-100 bg-white p-4 shadow-sm"
                >
                  <h3 className="font-sans text-lg font-semibold text-gray-800">{menu.title}</h3>
                  {menu.reason && (
                    <p className="mt-1 font-sans text-sm text-gray-600">{menu.reason}</p>
                  )}

                  {menu.usedIngredients?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 font-sans text-xs font-semibold text-green-700">사용 재료</p>
                      <div className="flex flex-wrap gap-1.5">
                        {menu.usedIngredients.map((name) => (
                          <span
                            key={`${menu.id}-used-${name}`}
                            className="rounded-full bg-green-50 px-2.5 py-0.5 font-sans text-xs text-green-800"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {menu.missingIngredients?.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 font-sans text-xs font-semibold text-orange-700">
                        있으면 좋은 재료
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {menu.missingIngredients.map((name) => (
                          <span
                            key={`${menu.id}-miss-${name}`}
                            className="rounded-full bg-orange-50 px-2.5 py-0.5 font-sans text-xs text-orange-800"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {menu.steps?.length > 0 && (
                    <ol className="mt-3 list-decimal space-y-1 pl-5 font-sans text-sm text-gray-700">
                      {menu.steps.map((step, index) => (
                        <li key={`${menu.id}-step-${index}`}>{step}</li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-5 py-2 font-sans font-medium text-gray-700 hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
