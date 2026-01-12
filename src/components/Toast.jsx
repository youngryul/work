import { useState, useEffect } from 'react'

/**
 * 토스트 메시지 타입
 */
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
}

/**
 * 토스트 컨텍스트
 */
const ToastContext = {
  toasts: [],
  listeners: [],
  
  /**
   * 토스트 추가
   */
  addToast: (message, type = TOAST_TYPES.INFO) => {
    const id = Date.now() + Math.random()
    const toast = { id, message, type }
    ToastContext.toasts = [...ToastContext.toasts, toast]
    ToastContext.listeners.forEach(listener => listener([...ToastContext.toasts]))
    
    // 3초 후 자동 제거
    setTimeout(() => {
      ToastContext.removeToast(id)
    }, 3000)
    
    return id
  },
  
  /**
   * 토스트 제거
   */
  removeToast: (id) => {
    ToastContext.toasts = ToastContext.toasts.filter(toast => toast.id !== id)
    ToastContext.listeners.forEach(listener => listener([...ToastContext.toasts]))
  },
  
  /**
   * 리스너 등록
   */
  subscribe: (listener) => {
    ToastContext.listeners.push(listener)
    return () => {
      ToastContext.listeners = ToastContext.listeners.filter(l => l !== listener)
    }
  },
}

/**
 * 토스트 표시 함수 (전역에서 사용 가능)
 */
export const showToast = (message, type = TOAST_TYPES.INFO) => {
  return ToastContext.addToast(message, type)
}

/**
 * 토스트 컨테이너 컴포넌트
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsubscribe = ToastContext.subscribe(setToasts)
    return unsubscribe
  }, [])

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-fade-in ${
            toast.type === TOAST_TYPES.SUCCESS
              ? 'bg-green-500 text-white'
              : toast.type === TOAST_TYPES.ERROR
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === TOAST_TYPES.SUCCESS && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === TOAST_TYPES.ERROR && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === TOAST_TYPES.INFO && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="flex-1 text-sm font-sans font-medium">{toast.message}</span>
            <button
              onClick={() => ToastContext.removeToast(toast.id)}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
