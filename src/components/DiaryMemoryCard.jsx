import { useEffect, useState } from 'react'
import { getDiaryByDate, getDiaryThumbUrl } from '../services/diaryService.js'
import {
  dismissDiaryMemoryToday,
  getOneYearAgoDateString,
  isDiaryMemoryDismissedToday,
  openDiaryByDate,
} from '../utils/diaryMemory.js'

/**
 * 오늘 할 일 상단의 '1년 전 오늘' 일기 카드
 * 1년 전 같은 날짜에 쓴 일기가 있을 때만 보이고, 닫으면 그날 하루는 다시 나오지 않는다.
 */
export default function DiaryMemoryCard() {
  const [diary, setDiary] = useState(null)

  useEffect(() => {
    if (isDiaryMemoryDismissedToday()) return
    let cancelled = false
    getDiaryByDate(getOneYearAgoDateString())
      .then((result) => {
        if (!cancelled && result) setDiary(result)
      })
      .catch(() => {
        // 조회 실패 시 카드를 띄우지 않음
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!diary) return null

  const thumbUrl = getDiaryThumbUrl(diary)
  const preview = (diary.content || '').trim()

  const handleDismiss = (event) => {
    event.stopPropagation()
    dismissDiaryMemoryToday()
    setDiary(null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openDiaryByDate(diary.date)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDiaryByDate(diary.date)
        }
      }}
      className="relative mb-6 flex gap-4 items-center rounded-2xl border-2 border-amber-200 bg-amber-50/95 p-4 pr-10 shadow-sm cursor-pointer hover:border-amber-300 hover:shadow-md transition-all font-sans"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="w-20 h-20 rounded-xl object-cover shrink-0 border border-amber-100 bg-white"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl shrink-0 bg-white border border-amber-100 flex items-center justify-center text-3xl">
          📔
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-700">📅 1년 전 오늘의 일기</p>
        <p className="mt-1 text-sm text-gray-700 line-clamp-2 whitespace-pre-line">
          {preview || '그날의 기록을 다시 열어 볼까요?'}
        </p>
        <p className="mt-1 text-xs text-amber-600">눌러서 다시 읽기 →</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 text-xl leading-none px-1"
        aria-label="오늘 하루 닫기"
        title="오늘 하루 닫기"
      >
        ×
      </button>
    </div>
  )
}
