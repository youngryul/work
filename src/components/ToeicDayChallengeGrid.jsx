import { useEffect, useMemo, useState } from 'react'
import {
  decrementToeicDayCompletion,
  getToeicDayCompletions,
  incrementToeicDayCompletion,
  setToeicDayCompletion,
} from '../services/toeicVocabCompletionService.js'
import {
  getCompletionCount,
  loadDayCompletions,
  saveDayCompletions,
} from '../utils/toeicDayCompletions.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const LOCAL_MIGRATED_KEY = 'toeic-norangi-day-completions-migrated-v1'
const BLACK_THRESHOLD = 28

/**
 * 검정 배경 제거한 포실이 data URL 로드
 * @returns {Promise<string>}
 */
async function loadPosiriTransparent() {
  const src = `${window.location.origin}/images/${encodeURIComponent('포실이.png')}`
  const response = await fetch(src)
  if (!response.ok) throw new Error('포실이 이미지를 불러오지 못했습니다')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('이미지 로드 실패'))
      el.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 사용할 수 없습니다')

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] <= BLACK_THRESHOLD &&
        data[i + 1] <= BLACK_THRESHOLD &&
        data[i + 2] <= BLACK_THRESHOLD
      ) {
        data[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 포실이 Day 완료 챌린지 그리드 (Day 전체 표시, DB 저장)
 */
export default function ToeicDayChallengeGrid({
  dayCount,
  selectedDay,
  onSelectDay,
}) {
  const [posiriSrc, setPosiriSrc] = useState('')
  const [completions, setCompletions] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const allDays = useMemo(() => {
    const list = []
    for (let day = 1; day <= dayCount; day += 1) list.push(day)
    return list
  }, [dayCount])

  useEffect(() => {
    let cancelled = false
    loadPosiriTransparent()
      .then((url) => {
        if (!cancelled) setPosiriSrc(url)
      })
      .catch(() => {
        if (!cancelled) {
          setPosiriSrc(`/images/${encodeURIComponent('포실이.png')}`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadFromDb() {
      setIsLoading(true)
      try {
        let map = await getToeicDayCompletions()

        if (localStorage.getItem(LOCAL_MIGRATED_KEY) !== '1') {
          const localMap = loadDayCompletions()
          const localEntries = Object.entries(localMap).filter(
            ([, count]) => Number(count) > 0,
          )

          if (localEntries.length > 0 && Object.keys(map).length === 0) {
            for (const [day, count] of localEntries) {
              await setToeicDayCompletion(Number(day), Number(count))
            }
            map = await getToeicDayCompletions()
          }

          localStorage.setItem(LOCAL_MIGRATED_KEY, '1')
        }

        if (cancelled) return
        setCompletions(map)
      } catch (error) {
        if (cancelled) return
        setCompletions(loadDayCompletions())
        showToast(
          error.message ||
            '완료 기록을 불러오지 못했습니다. 로컬로 임시 저장합니다.',
          TOAST_TYPES.ERROR,
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadFromDb()
    return () => {
      cancelled = true
    }
  }, [])

  const applyLocalCount = (day, count) => {
    setCompletions((prev) => {
      const next = { ...prev }
      if (count <= 0) delete next[String(day)]
      else next[String(day)] = count
      saveDayCompletions(next)
      return next
    })
  }

  const handleComplete = async (day) => {
    if (isSaving) return
    onSelectDay(day)
    const optimistic = getCompletionCount(completions, day) + 1
    applyLocalCount(day, optimistic)
    setIsSaving(true)
    try {
      const count = await incrementToeicDayCompletion(day)
      applyLocalCount(day, count)
      showToast(`DAY ${day} · 완료 ${count}회`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(
        error.message || '완료 저장에 실패했습니다. 로컬에만 반영됩니다.',
        TOAST_TYPES.ERROR,
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDecrease = async (day, event) => {
    event.stopPropagation()
    if (isSaving) return
    const current = getCompletionCount(completions, day)
    if (current <= 0) return

    const optimistic = current - 1
    applyLocalCount(day, optimistic)
    setIsSaving(true)
    try {
      const count = await decrementToeicDayCompletion(day)
      applyLocalCount(day, count)
      showToast(
        count > 0
          ? `DAY ${day} · 완료 ${count}회`
          : `DAY ${day} · 완료 기록 삭제`,
        TOAST_TYPES.INFO,
      )
    } catch (error) {
      showToast(
        error.message || '완료 수정에 실패했습니다. 로컬에만 반영됩니다.',
        TOAST_TYPES.ERROR,
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[#c9d4f0] bg-[#fbf9f4] px-4 py-5 sm:px-6 shadow-sm">
      <div className="text-center mb-4">
        <p
          className="text-[#8ea0d4] text-2xl sm:text-3xl leading-none"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
          }}
        >
          day challenge
        </p>
        <p className="mt-1 text-sm font-medium text-[#8ea0d4]">
          Day 완료 기록 · DAY 1-{dayCount}
        </p>
        {isLoading && (
          <p className="mt-1 text-[11px] text-[#9aabdb]">
            완료 기록 불러오는 중...
          </p>
        )}
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-x-2 gap-y-4">
        {allDays.map((day, index) => {
          const count = getCompletionCount(completions, day)
          const isSelected = day === selectedDay
          const isLast = index === allDays.length - 1

          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={`text-[10px] sm:text-xs font-semibold tabular-nums ${
                  isSelected
                    ? 'text-[#5a6fb8]'
                    : 'text-[#9aabdb] hover:text-[#6d7fb8]'
                }`}
              >
                Day {day}
              </button>

              <button
                type="button"
                onClick={() => handleComplete(day)}
                disabled={isSaving}
                className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-70 ${
                  isSelected
                    ? 'ring-2 ring-[#8ea0d4] ring-offset-2 ring-offset-[#fbf9f4]'
                    : ''
                }`}
                aria-label={`DAY ${day} 완료 기록 (현재 ${count}회)`}
                title="클릭하면 완료 횟수가 늘어나요"
              >
                {posiriSrc ? (
                  <img
                    src={posiriSrc}
                    alt=""
                    className={`w-full h-full object-contain transition-opacity ${
                      count > 0 ? 'opacity-100' : 'opacity-40'
                    }`}
                    draggable={false}
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-[#dfe6f8] animate-pulse" />
                )}

                {count > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-[#8ea0d4] text-white text-[10px] font-bold leading-[1.15rem] tabular-nums shadow-sm">
                    {count}
                  </span>
                )}

                {isLast && (
                  <span
                    className="pointer-events-none absolute -top-1 -right-1 text-[10px] leading-none"
                    aria-hidden="true"
                  >
                    {'💕'}
                  </span>
                )}
              </button>

              {count > 0 && (
                <button
                  type="button"
                  onClick={(e) => handleDecrease(day, e)}
                  disabled={isSaving}
                  className="text-[10px] text-[#9aabdb] hover:text-[#6d7fb8] disabled:opacity-50"
                  aria-label={`DAY ${day} 완료 1회 줄이기`}
                >
                  -1
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-[#9aabdb]">
        포실이 클릭 = 완료 +1 / -1 = 완료 줄이기 / Day 글자 클릭 = 공부 Day 선택
      </p>
    </section>
  )
}
