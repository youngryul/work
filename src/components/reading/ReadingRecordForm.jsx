import { useState, useEffect } from 'react'
import { createReadingRecord, updateReadingRecord } from '../../services/readingService.js'
import ReadingTimer from './ReadingTimer.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 독서 기록 폼 컴포넌트
 */
export default function ReadingRecordForm({ book, initialRecord, onSave, onCancel }) {
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0])
  const [pagesRead, setPagesRead] = useState('')
  const [notes, setNotes] = useState('')
  const [readingMinutes, setReadingMinutes] = useState(null)
  const [useTimer, setUseTimer] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [endTime, setEndTime] = useState(null)

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (initialRecord) {
      setReadingDate(initialRecord.readingDate || new Date().toISOString().split('T')[0])
      setPagesRead(initialRecord.pagesRead ? String(initialRecord.pagesRead) : '')
      setNotes(initialRecord.notes || '')
      setReadingMinutes(initialRecord.readingMinutes || null)
      setStartTime(initialRecord.startTime || null)
      setEndTime(initialRecord.endTime || null)
    }
  }, [initialRecord])

  /**
   * 타이머 완료 처리
   */
  const handleTimerComplete = (totalSeconds) => {
    const endTimeNow = new Date().toISOString()
    setEndTime(endTimeNow)
    
    // 시작 시간과 종료 시간의 실제 차이만 계산 (타이머 경과 시간 무시)
    if (startTime) {
      const start = new Date(startTime)
      const end = new Date(endTimeNow)
      const diffMs = end.getTime() - start.getTime()
      const diffMinutes = Math.max(0, Math.floor(diffMs / 60000)) // 밀리초를 분으로 변환, 최소 0분
      setReadingMinutes(diffMinutes)
      console.log('[독서 기록] 시작 시간:', startTime)
      console.log('[독서 기록] 종료 시간:', endTimeNow)
      console.log('[독서 기록] 실제 차이:', diffMs, 'ms =', diffMinutes, '분')
    } else {
      // 시작 시간이 없으면 0분으로 설정
      console.warn('[독서 기록] 시작 시간이 없어서 0분으로 설정합니다.')
      setReadingMinutes(0)
    }
    // 타이머는 계속 표시되도록 유지 (useTimer를 false로 하지 않음)
  }

  /**
   * 타이머 시작 처리
   */
  const handleTimerStart = () => {
    if (!startTime) {
      setStartTime(new Date().toISOString())
      // 타이머 시작 시 이전 값 초기화
      setReadingMinutes(null)
      setEndTime(null)
    }
  }

  /**
   * 기록 저장
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!book) {
      showToast('책을 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      // 시작 시간과 종료 시간 계산
      let finalStartTime = startTime
      let finalEndTime = endTime
      let finalReadingMinutes = readingMinutes
      
      // 시작 시간이 있지만 종료 시간이 없으면 현재 시간을 종료 시간으로 설정
      if (startTime && !endTime) {
        finalEndTime = new Date().toISOString()
        const start = new Date(startTime)
        const end = new Date(finalEndTime)
        const diffMs = end.getTime() - start.getTime()
        finalReadingMinutes = Math.max(0, Math.floor(diffMs / 60000))
        console.log('[독서 기록 저장] 타이머 종료 없이 저장 - 시작:', startTime)
        console.log('[독서 기록 저장] 타이머 종료 없이 저장 - 종료:', finalEndTime)
        console.log('[독서 기록 저장] 타이머 종료 없이 저장 - 실제 차이:', diffMs, 'ms =', finalReadingMinutes, '분')
      } else if (startTime && endTime) {
        // 시작 시간과 종료 시간이 모두 있으면 실제 차이를 다시 계산
        const start = new Date(startTime)
        const end = new Date(endTime)
        const diffMs = end.getTime() - start.getTime()
        finalReadingMinutes = Math.max(0, Math.floor(diffMs / 60000))
        console.log('[독서 기록 저장] 시작:', startTime)
        console.log('[독서 기록 저장] 종료:', endTime)
        console.log('[독서 기록 저장] 실제 차이:', diffMs, 'ms =', finalReadingMinutes, '분')
      } else if (!finalReadingMinutes) {
        // 타이머를 사용하지 않은 경우에만 페이지 기반 추정 사용
        finalReadingMinutes = pagesRead ? parseInt(pagesRead) * 2 : null
      }

      if (initialRecord) {
        // 수정 모드
        await updateReadingRecord(initialRecord.id, {
          readingDate,
          startTime: finalStartTime || null,
          endTime: finalEndTime || null,
          readingMinutes: finalReadingMinutes,
          pagesRead: pagesRead ? parseInt(pagesRead) : null,
          notes: notes.trim() || null,
        })
      } else {
        // 생성 모드
        await createReadingRecord({
          bookId: book.id,
          readingDate,
          startTime: finalStartTime || null,
          endTime: finalEndTime || null,
          readingMinutes: finalReadingMinutes,
          pagesRead: pagesRead ? parseInt(pagesRead) : null,
          notes: notes.trim() || null,
        })
      }
      
      onSave?.()
      // 폼 초기화
      setPagesRead('')
      setNotes('')
      setReadingMinutes(null)
      setStartTime(null)
      setEndTime(null)
    } catch (error) {
      console.error('독서 기록 저장 오류:', error)
      showToast('독서 기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">
        {initialRecord ? '독서 기록 수정' : '독서 기록'}
      </h2>
      
      {book && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-xl font-bold text-gray-800 mb-1">{book.title}</h3>
          <p className="text-gray-600 text-sm">저자: {book.author || '알 수 없음'}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 날짜 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            독서 날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            required
          />
        </div>

        {/* 타이머 사용 여부 */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="useTimer"
            checked={useTimer}
            onChange={(e) => {
              setUseTimer(e.target.checked)
              // 타이머 체크박스를 해제하면 초기화
              if (!e.target.checked) {
                setStartTime(null)
                setEndTime(null)
                setReadingMinutes(null)
              }
            }}
            className="w-5 h-5"
          />
          <label htmlFor="useTimer" className="text-base font-medium text-gray-700">
            타이머 사용
          </label>
        </div>

        {/* 타이머 */}
        {useTimer && (
          <ReadingTimer
            onTimerStart={handleTimerStart}
            onTimerComplete={handleTimerComplete}
            initialMinutes={0}
          />
        )}

        {/* 독서 시간 (타이머 미사용 시) */}
        {!useTimer && (
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              독서 시간 (분)
            </label>
            <input
              type="number"
              value={readingMinutes || ''}
              onChange={(e) => setReadingMinutes(e.target.value ? parseInt(e.target.value) || null : null)}
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="독서한 시간을 입력하세요"
            />
          </div>
        )}

        {/* 읽은 페이지 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            읽은 페이지
          </label>
          <input
            type="number"
            value={pagesRead}
            onChange={(e) => setPagesRead(e.target.value)}
            min="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="읽은 페이지 수를 입력하세요"
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            메모
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="독서 메모를 입력하세요"
            rows={4}
          />
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-base font-medium"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  )
}

