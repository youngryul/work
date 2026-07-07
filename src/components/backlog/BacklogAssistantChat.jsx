import { useEffect, useRef, useState } from 'react'
import { BACKLOG_ASSISTANT_QUICK_PROMPTS } from '../../constants/backlogAssistant.js'
import { useAiTokenInfo } from '../../hooks/useAiTokenInfo.js'
import { getCategories } from '../../services/categoryService.js'
import {
  buildBacklogAssistantContext,
  confirmBacklogSuggestions,
  formatSuggestionScheduleLabel,
  sendBacklogAssistantMessage,
} from '../../services/backlogAssistantService.js'
import TokenDepositRequestModal from '../TokenDepositRequestModal.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'user' | 'assistant'} role
 * @property {string} content
 */

/**
 * 백로그 AI 어시스턴트 채팅 (오른쪽 하단 플로팅)
 * @param {{ onTasksCreated: () => void }} props
 */
export default function BacklogAssistantChat({ onTasksCreated }) {
  const { balance: tokenBalance, backlogAssistantCost, reload: reloadTokenInfo } = useAiTokenInfo()
  const [isOpen, setIsOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! 백로그·오늘 할일·습관을 분석해 할일을 추천해 드려요. 큰 할일은 「자동 쪼개기」로 실행 가능한 단계로 나눌 수 있어요. 분석 1회마다 AI 토큰이 소모되며, 확인 후 확정하면 백로그에 등록됩니다.',
    },
  ])
  const [draftSuggestions, setDraftSuggestions] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const hasEnoughTokens = (tokenBalance ?? 0) >= (backlogAssistantCost ?? 1)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories()
        setCategories(cats.map((cat) => cat.name))
      } catch {
        setCategories([])
      }
    }
    loadCategories()

    const handleCategoryChange = () => loadCategories()
    window.addEventListener('categoryChanged', handleCategoryChange)
    return () => window.removeEventListener('categoryChanged', handleCategoryChange)
  }, [])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, draftSuggestions, isOpen, isLoading])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const openDepositModal = () => {
    setDepositModalOpen(true)
  }

  /**
   * @param {string} text
   */
  const handleSend = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    if (!hasEnoughTokens) {
      showToast(
        `AI 토큰이 부족합니다. (보유: ${tokenBalance ?? 0}, 필요: ${backlogAssistantCost})`,
        TOAST_TYPES.ERROR,
      )
      openDepositModal()
      return
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setDraftSuggestions([])
    setIsLoading(true)

    try {
      const context = await buildBacklogAssistantContext()
      const history = [...messages, userMessage]
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          role: message.role,
          content: message.content,
        }))

      const result = await sendBacklogAssistantMessage(history, context)

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
        },
      ])

      setDraftSuggestions(
        result.suggestions.map((suggestion) => ({
          ...suggestion,
          selected: true,
        })),
      )
    } catch (error) {
      const message = error?.message || 'AI 응답에 실패했습니다.'
      const isTokenError = message.includes('토큰')

      if (isTokenError) {
        openDepositModal()
        setMessages((prev) => prev.filter((item) => item.id !== userMessage.id))
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: '죄송해요, 분석 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
          },
        ])
      }

      showToast(message, TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmSuggestions = async () => {
    const selected = draftSuggestions.filter((item) => item.selected)
    if (selected.length === 0) {
      showToast('등록할 할일을 하나 이상 선택해 주세요.', TOAST_TYPES.INFO)
      return
    }

    const invalid = selected.find((item) => !item.category)
    if (invalid) {
      showToast('모든 할일의 카테고리를 선택해 주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsConfirming(true)
    try {
      const createdCount = await confirmBacklogSuggestions(selected)
      setDraftSuggestions([])
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-confirmed-${Date.now()}`,
          role: 'assistant',
          content: `총 ${createdCount}개의 할일을 백로그에 등록했어요. 필요하면 카테고리나 예약일을 목록에서 수정할 수 있어요.`,
        },
      ])
      showToast(`백로그에 ${createdCount}개 할일을 등록했습니다.`, TOAST_TYPES.SUCCESS)
      onTasksCreated?.()
    } catch (error) {
      showToast(error?.message || '백로그 등록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsConfirming(false)
    }
  }

  const updateDraftSuggestion = (id, patch) => {
    setDraftSuggestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[min(100vw-3rem,24rem)] max-h-[min(70vh,32rem)] flex flex-col rounded-2xl border border-green-200 bg-white shadow-2xl overflow-hidden font-sans"
          role="dialog"
          aria-label="백로그 AI 어시스턴트"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white shrink-0">
            <div className="min-w-0">
              <p className="text-xs text-green-100">OpenAI 분석</p>
              <h3 className="font-bold text-sm">백로그 어시스턴트</h3>
              <p className="text-xs text-green-50 mt-0.5">
                토큰 {tokenBalance ?? 0}개 · 분석 1회 {backlogAssistantCost}개
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!hasEnoughTokens && (
                <button
                  type="button"
                  onClick={openDepositModal}
                  className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30"
                >
                  충전
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/90 hover:text-white text-xl leading-none px-1"
                aria-label="채팅 닫기"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-green-500 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white border border-gray-200 px-3 py-2 text-sm text-gray-500 shadow-sm">
                  분석 중... (토큰 {backlogAssistantCost}개 사용)
                </div>
              </div>
            )}

            {draftSuggestions.length > 0 && !isLoading && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/80 p-3 space-y-3">
                <div>
                  <p className="text-sm font-bold text-amber-900">추천 할일 확인</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    카테고리를 확인한 뒤 선택한 항목만 백로그에 등록됩니다.
                  </p>
                </div>

                {draftSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`rounded-lg border p-3 bg-white space-y-2 ${
                      suggestion.selected ? 'border-green-300' : 'border-gray-200 opacity-70'
                    }`}
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={suggestion.selected}
                        onChange={(e) =>
                          updateDraftSuggestion(suggestion.id, { selected: e.target.checked })
                        }
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{suggestion.title}</p>
                        {suggestion.reason && (
                          <p className="text-xs text-gray-500 mt-1">{suggestion.reason}</p>
                        )}
                        {suggestion.memo && (
                          <p className="text-xs text-blue-600 mt-1">{suggestion.memo}</p>
                        )}
                        {suggestion.recurrence !== 'none' && (
                          <p className="text-xs text-purple-700 mt-1">
                            반복: {suggestion.recurrence} · {formatSuggestionScheduleLabel(suggestion)}
                          </p>
                        )}
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1 block">카테고리 *</span>
                      <select
                        value={suggestion.category}
                        onChange={(e) =>
                          updateDraftSuggestion(suggestion.id, { category: e.target.value })
                        }
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                      >
                        {categories.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleConfirmSuggestions}
                  disabled={isConfirming}
                  className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {isConfirming ? '등록 중...' : '선택 항목 백로그에 확정 등록'}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white p-3 space-y-2">
            {!hasEnoughTokens && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                AI 토큰이 부족합니다. 분석하려면 토큰을 충전해 주세요.
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {BACKLOG_ASSISTANT_QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  disabled={isLoading || !hasEnoughTokens}
                  onClick={() => handleSend(prompt.message)}
                  className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend(input)
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  hasEnoughTokens
                    ? '예: 이번 주 우선순위 할일 추천해줘'
                    : '토큰 충전 후 이용 가능합니다'
                }
                disabled={isLoading || !hasEnoughTokens}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !hasEnoughTokens}
                className="px-3 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 shrink-0"
              >
                전송
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-2xl ${
          isOpen
            ? 'bg-gray-700 text-white hover:bg-gray-800'
            : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
        }`}
        aria-label={isOpen ? 'AI 채팅 닫기' : 'AI 채팅 열기'}
        title="백로그 AI 어시스턴트"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      <TokenDepositRequestModal
        isOpen={depositModalOpen}
        onClose={() => {
          setDepositModalOpen(false)
          reloadTokenInfo()
        }}
        tokenBalance={tokenBalance}
        generationCost={backlogAssistantCost}
      />
    </>
  )
}
