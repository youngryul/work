import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { updateRecord } from '../services/recordService.js'
import { splitTextLinks } from '../utils/linkParser.js'

/** 본문 textarea와 링크 레이어가 같은 글자 배치를 갖도록 공유하는 스타일 */
const CONTENT_TEXT_CLASS =
  'w-full text-base leading-relaxed font-sans whitespace-pre-wrap break-words'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/** 입력이 멈춘 뒤 자동 저장까지 대기 시간 (대학원 기록과 동일) */
const AUTO_SAVE_DELAY_MS = 2000

/**
 * textarea 높이 자동 조절 (리사이즈 중 스크롤 위치가 튀지 않도록 유지)
 */
function autoResize(el) {
  if (!el) return
  const scrollContainer = el.closest('.overflow-y-auto')
  const prevScrollTop = scrollContainer?.scrollTop
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
  if (scrollContainer && prevScrollTop != null) {
    scrollContainer.scrollTop = prevScrollTop
  }
}

/**
 * 기록 팝업 에디터 컴포넌트 (대학원 기록처럼 열자마자 바로 작성, 입력 후 자동 저장)
 * @param {Object} record - 기록 데이터
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러 (대기 중인 변경을 저장한 뒤 호출)
 * @param {Function} onSaved - 저장 완료 핸들러 (저장된 기록 전달)
 * @param {Function} onDelete - 삭제 핸들러
 * @param {Function} onSetMain - 메인 기록 설정 핸들러
 * @param {Function} onUnsetMain - 메인 기록 해제 핸들러
 */
export default function RecordModal({ record, isOpen, onClose, onSaved, onDelete, onSetMain, onUnsetMain }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const latestRef = useRef(null) // 최신 입력값
  const lastSavedRef = useRef(null) // 마지막으로 저장한 스냅샷(JSON)
  const savingPromiseRef = useRef(null)
  const contentRef = useRef(null)

  // 기록 변경 시 상태 초기화
  useEffect(() => {
    if (!record) return
    const loaded = {
      title: record.title ?? '',
      date: record.date || format(new Date(), 'yyyy-MM-dd'),
      content: record.content || record.background || '',
    }
    // 불러온 내용 그대로는 다시 저장하지 않는다
    lastSavedRef.current = JSON.stringify(loaded)
    latestRef.current = loaded
    setTitle(loaded.title)
    setDate(loaded.date)
    setContent(loaded.content)
    setSavedAt(null)
    setConfirmingDelete(false)
  }, [record?.id])

  /**
   * 현재 입력을 저장
   * @returns {Promise<boolean|null>} 저장 성공 true, 실패 false, 저장할 변경 없음 null
   */
  const saveNow = useCallback(async () => {
    if (savingPromiseRef.current) await savingPromiseRef.current
    const data = latestRef.current
    if (!record?.id || !data) return null
    const snapshot = JSON.stringify(data)
    if (snapshot === lastSavedRef.current) return null

    const run = (async () => {
      setSaving(true)
      try {
        const saved = await updateRecord(record.id, {
          projectName: record.projectName,
          date: data.date,
          title: data.title,
          content: data.content,
        })
        lastSavedRef.current = snapshot
        setSavedAt(new Date())
        onSaved?.(saved)
        return true
      } catch (error) {
        console.error('자동 저장 실패:', error)
        showToast('기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
        return false
      } finally {
        setSaving(false)
      }
    })()

    savingPromiseRef.current = run
    try {
      return await run
    } finally {
      if (savingPromiseRef.current === run) savingPromiseRef.current = null
    }
  }, [record?.id, record?.projectName, onSaved])

  // 입력이 멈추면 자동 저장
  useEffect(() => {
    if (!record) return
    latestRef.current = { title, date, content }
    const timer = setTimeout(() => { saveNow() }, AUTO_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [title, date, content, record, saveNow])

  // 본문을 글자·사이트 주소 구간으로 나눔 (textarea 위에 겹친 레이어에서 주소만 클릭 가능하게 그림)
  const contentSegments = useMemo(() => splitTextLinks(content), [content])
  const hasLinks = contentSegments.some((segment) => segment.type === 'link')

  // 본문 높이 맞추기
  useEffect(() => {
    autoResize(contentRef.current)
  }, [content, isOpen])

  // 닫기: 대기 중인 변경을 바로 저장한 뒤 닫는다
  const handleClose = useCallback(async () => {
    const result = await saveNow()
    if (result === false) return // 저장 실패 시 작성 내용을 잃지 않도록 머문다
    onClose?.()
  }, [saveNow, onClose])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // 메인 설정/해제 전 대기 중인 변경 저장
  const handleToggleMain = async () => {
    await saveNow()
    if (record.isMain) onUnsetMain?.(record.id)
    else onSetMain?.(record.id)
  }

  if (!isOpen || !record) return null

  const saveStatus = saving
    ? '저장 중...'
    : savedAt
      ? `저장됨 ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
      : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 바 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-5 sm:px-6 py-3 border-b border-gray-100 shrink-0">
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1 shrink-0 max-w-[10rem] truncate font-sans">
            {record.projectName}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm text-gray-500 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-300"
          />
          <span className="text-xs text-gray-400 font-sans">{saveStatus}</span>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              onClick={handleToggleMain}
              className={`text-xs px-2 py-1 rounded transition-colors font-sans ${
                record.isMain
                  ? 'text-yellow-600 hover:bg-yellow-50'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
              }`}
              title={record.isMain ? '메인 기록 해제' : '메인 기록으로 설정'}
            >
              📌 {record.isMain ? '메인 해제' : '메인 설정'}
            </button>
            {confirmingDelete ? (
              <>
                <button
                  onClick={() => onDelete?.(record.id)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 font-sans"
                >
                  삭제 확인
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 font-sans"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors font-sans"
                title="기록 삭제"
              >
                삭제
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 에디터 본문 */}
        <div
          className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 cursor-text"
          onClick={(e) => {
            // 빈 여백을 누르면 본문 끝으로 커서 이동
            if (e.target === e.currentTarget) {
              const el = contentRef.current
              if (el) {
                el.focus()
                el.setSelectionRange(el.value.length, el.value.length)
              }
            }
          }}
        >
          {/* 제목 입력 */}
          <textarea
            placeholder="제목 없음"
            value={title}
            onChange={(e) => {
              autoResize(e.target)
              setTitle(e.target.value)
            }}
            ref={(el) => el && autoResize(el)}
            rows={1}
            className="w-full text-2xl sm:text-3xl font-sans font-bold text-gray-900 placeholder-gray-300 resize-none border-none outline-none bg-transparent mb-4 leading-tight"
          />

          {/* 본문 입력: 주소가 있으면 textarea 글자는 투명하게 두고, 같은 배치의 레이어가 글자와 링크를 그린다 */}
          <div className="relative">
            <textarea
              ref={contentRef}
              placeholder="내용을 입력하세요..."
              value={content}
              onChange={(e) => {
                autoResize(e.target)
                setContent(e.target.value)
              }}
              rows={8}
              className={`${CONTENT_TEXT_CLASS} block min-h-[12rem] placeholder-gray-300 resize-none border-none outline-none bg-transparent p-0 ${
                hasLinks ? 'text-transparent caret-gray-700' : 'text-gray-700'
              }`}
            />
            {hasLinks && (
              <div
                aria-hidden
                className={`${CONTENT_TEXT_CLASS} absolute inset-0 text-gray-700 pointer-events-none`}
              >
                {contentSegments.map((segment, index) =>
                  segment.type === 'link' ? (
                    <a
                      key={index}
                      href={segment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${segment.url} 열기`}
                      className="pointer-events-auto text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 hover:decoration-blue-500 cursor-pointer"
                    >
                      {segment.content}
                    </a>
                  ) : (
                    <span key={index}>{segment.content}</span>
                  ),
                )}
                {/* 마지막 줄바꿈도 textarea와 같은 높이로 보이게 */}
                {'​'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
