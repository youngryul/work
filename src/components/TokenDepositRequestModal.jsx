import { useEffect, useState } from 'react'

import {

  AI_TOKEN_BANK_ACCOUNT,

  AI_TOKEN_BANK_NAME,

  AI_TOKEN_RECOMMENDED_PACKAGES,

  formatKrw,

  getRecommendedPriceKrw,

} from '../constants/aiTokenPurchase.js'

import { submitTokenPurchaseRequest } from '../services/aiTokenPurchaseService.js'

import { useAuth } from '../contexts/AuthContext.jsx'

import { showToast, TOAST_TYPES } from './Toast.jsx'



/**

 * 무통장 입금 안내 및 토큰 충전 신청 모달

 * @param {{

 *   isOpen: boolean,

 *   onClose: () => void,

 *   tokenBalance?: number | null,

 *   generationCost?: number,

 * }} props

 */

export default function TokenDepositRequestModal({

  isOpen,

  onClose,

  tokenBalance = 0,

  generationCost = 3,

}) {

  const { user } = useAuth()

  const [depositorName, setDepositorName] = useState('')

  const [depositAmountKrw, setDepositAmountKrw] = useState('')

  const [requestedTokens, setRequestedTokens] = useState('10')

  const [isSubmitting, setIsSubmitting] = useState(false)



  const isLow = (tokenBalance ?? 0) < generationCost



  useEffect(() => {

    if (!isOpen) return

    setRequestedTokens('10')

    setDepositAmountKrw(String(AI_TOKEN_RECOMMENDED_PACKAGES[0].priceKrw))

  }, [isOpen])



  useEffect(() => {

    const tokens = Number(requestedTokens)

    if (!requestedTokens || Number.isNaN(tokens) || tokens <= 0) return

    setDepositAmountKrw(String(getRecommendedPriceKrw(tokens)))

  }, [requestedTokens])



  const handleSelectPackage = (pkg) => {

    setRequestedTokens(String(pkg.tokens))

    setDepositAmountKrw(String(pkg.priceKrw))

  }



  const handleCopyAccount = () => {

    navigator.clipboard?.writeText(AI_TOKEN_BANK_ACCOUNT)

    showToast('계좌번호를 복사했습니다.', TOAST_TYPES.SUCCESS)

  }



  const handleSubmit = async (e) => {

    e.preventDefault()

    setIsSubmitting(true)

    try {

      await submitTokenPurchaseRequest({

        depositorName,

        depositAmountKrw: Number(depositAmountKrw),

        requestedTokens: Number(requestedTokens),

        userEmail: user?.email,

      })

      showToast('충전 신청이 접수되었습니다. 입금 확인 후 토큰이 지급됩니다.', TOAST_TYPES.SUCCESS)

      onClose()

    } catch (error) {

      showToast(error?.message || '신청에 실패했습니다.', TOAST_TYPES.ERROR)

    } finally {

      setIsSubmitting(false)

    }

  }



  if (!isOpen) return null



  return (

    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">

      <div

        className="w-full max-w-xl max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"

        role="dialog"

        aria-modal="true"

        aria-labelledby="token-deposit-title"

      >

        <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-5 rounded-t-2xl">

          <div className="flex items-start justify-between gap-3">

            <div>

              <p className="text-amber-100 text-xs font-semibold tracking-wide mb-1">AI 일기 그림 생성</p>

              <h2 id="token-deposit-title" className="text-xl font-bold text-white font-sans">

                {isLow ? '토큰이 부족합니다' : 'AI 토큰 충전'}

              </h2>

              <p className="mt-1.5 text-sm text-amber-50">

                현재 <strong className="text-white">{tokenBalance ?? 0}개</strong> 보유

                {isLow && (

                  <>

                    {' '}

                    · 생성 1회 <strong className="text-white">{generationCost}개</strong> 필요

                  </>

                )}

              </p>

            </div>

            <button

              type="button"

              onClick={onClose}

              className="text-white/80 hover:text-white text-2xl leading-none shrink-0"

              aria-label="닫기"

            >

              ×

            </button>

          </div>

        </div>



        <div className="p-5 space-y-5 font-sans">

          <section className="rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">

            <div className="flex items-center gap-2 mb-3">

              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">

                1

              </span>

              <p className="text-base font-bold text-blue-900">아래 계좌로 입금해 주세요</p>

            </div>

            <div className="rounded-xl bg-white border border-blue-200 px-4 py-3">

              <p className="text-xs text-blue-600 font-medium mb-1">{AI_TOKEN_BANK_NAME}</p>

              <p className="text-2xl font-bold text-blue-900 tracking-wide break-all">

                {AI_TOKEN_BANK_ACCOUNT}

              </p>

            </div>

            <button

              type="button"

              onClick={handleCopyAccount}

              className="mt-3 w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"

            >

              📋 계좌번호 복사

            </button>

          </section>



          <section>

            <p className="text-sm font-bold text-gray-800 mb-3">충전 패키지 선택</p>

            <div className="grid gap-2">

              {AI_TOKEN_RECOMMENDED_PACKAGES.map((pkg) => {

                const isSelected = Number(requestedTokens) === pkg.tokens

                return (

                  <button

                    key={pkg.tokens}

                    type="button"

                    onClick={() => handleSelectPackage(pkg)}

                    className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all ${

                      isSelected

                        ? 'border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-200'

                        : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50'

                    }`}

                  >

                    <div className="flex items-center justify-between gap-2">

                      <span className="text-lg font-bold text-gray-800">{pkg.tokens}토큰</span>

                      <span className="text-lg font-bold text-amber-700">{formatKrw(pkg.priceKrw)}</span>

                    </div>

                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>

                  </button>

                )

              })}

            </div>

          </section>



          <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5">

            <div className="flex items-center gap-2 mb-4">

              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">

                2

              </span>

              <p className="text-base font-bold text-amber-900">입금 후 충전 신청서 제출</p>

            </div>



            <form onSubmit={handleSubmit} className="space-y-3">

              <label className="block">

                <span className="text-sm font-medium text-gray-700 mb-1 block">입금자명 *</span>

                <input

                  type="text"

                  value={depositorName}

                  onChange={(e) => setDepositorName(e.target.value)}

                  placeholder="입금 시 사용한 이름"

                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"

                  required

                />

              </label>



              <div className="grid grid-cols-2 gap-3">

                <label className="block">

                  <span className="text-sm font-medium text-gray-700 mb-1 block">입금 금액 (원) *</span>

                  <input

                    type="number"

                    min={1}

                    value={depositAmountKrw}

                    onChange={(e) => setDepositAmountKrw(e.target.value)}

                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"

                    required

                  />

                </label>

                <label className="block">

                  <span className="text-sm font-medium text-gray-700 mb-1 block">신청 토큰 수 *</span>

                  <input

                    type="number"

                    min={1}

                    value={requestedTokens}

                    onChange={(e) => setRequestedTokens(e.target.value)}

                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"

                    required

                  />

                </label>

              </div>



              <button

                type="submit"

                disabled={isSubmitting}

                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-base font-bold hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-lg transition-all"

              >

                {isSubmitting ? '제출 중...' : '✅ 충전 신청 제출'}

              </button>

            </form>

          </section>



          <button

            type="button"

            onClick={onClose}

            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"

          >

            닫기

          </button>

        </div>

      </div>

    </div>

  )

}


