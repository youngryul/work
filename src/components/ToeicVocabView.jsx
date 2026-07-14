import { useEffect, useMemo, useState } from 'react'
import toeicVocabRaw from '../data/toeicNorangiVocab.json'
import ToeicDayChallengeGrid from './ToeicDayChallengeGrid.jsx'
import { printToeicDayPdf } from '../utils/toeicVocabPdf.js'
import { regroupVocabByDaySize, WORDS_PER_DAY } from '../utils/toeicVocabDays.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const STORAGE_KEY_DAY = 'toeic-norangi-selected-day-v30'
const STUDY_MODES = [
  { id: 'list', label: '전체 목록' },
  { id: 'flash', label: '플래시카드' },
  { id: 'challenge', label: '완료 기록' },
]

const toeicVocab = regroupVocabByDaySize(toeicVocabRaw, WORDS_PER_DAY)

/**
 * @param {Array<{ id: number, en: string, ko: string }>} words
 * @returns {Array<{ id: number, en: string, ko: string }>}
 */
function shuffleWords(words) {
  const next = [...words]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/**
 * 토익 노랭이 단어 학습 (Day별 목록 · 플래시카드 · PDF 인쇄)
 */
export default function ToeicVocabView() {
  const days = toeicVocab.days
  const [selectedDay, setSelectedDay] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY_DAY))
    if (Number.isFinite(saved) && saved >= 1 && saved <= days.length) return saved
    return 1
  })
  const [studyMode, setStudyMode] = useState('list')
  const [flashIndex, setFlashIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [flashOrder, setFlashOrder] = useState([])
  const [showKoreanFirst, setShowKoreanFirst] = useState(false)

  const dayData = useMemo(
    () => days.find((d) => d.day === selectedDay) ?? days[0],
    [days, selectedDay],
  )
  const words = dayData?.words ?? []

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DAY, String(selectedDay))
  }, [selectedDay])

  useEffect(() => {
    setFlashOrder(words.map((_, i) => i))
    setFlashIndex(0)
    setIsFlipped(false)
  }, [selectedDay, words])

  const currentWord =
    flashOrder.length > 0 ? words[flashOrder[flashIndex]] : null
  const frontText = showKoreanFirst ? currentWord?.ko : currentWord?.en
  const backText = showKoreanFirst ? currentWord?.en : currentWord?.ko

  const handleSelectDay = (day) => {
    setSelectedDay(day)
  }

  const handleShuffle = () => {
    setFlashOrder(shuffleWords([...Array(words.length).keys()]))
    setFlashIndex(0)
    setIsFlipped(false)
    showToast('순서를 섞었습니다', TOAST_TYPES.SUCCESS)
  }

  const goPrev = () => {
    setIsFlipped(false)
    setFlashIndex((i) => (i <= 0 ? flashOrder.length - 1 : i - 1))
  }

  const goNext = () => {
    setIsFlipped(false)
    setFlashIndex((i) => (i >= flashOrder.length - 1 ? 0 : i + 1))
  }

  /** 1클릭: 뜻 표시, 2클릭: 다음 단어 */
  const handleCardClick = () => {
    if (!isFlipped) {
      setIsFlipped(true)
      return
    }
    setIsFlipped(false)
    setFlashIndex((i) => (i >= flashOrder.length - 1 ? 0 : i + 1))
  }

  const handlePrintPdf = async (mode) => {
    try {
      await printToeicDayPdf({ day: selectedDay, words, mode })
      showToast(
        mode === 'en'
          ? '포실이 단어장(영어) — 인쇄 창에서 PDF로 저장하세요'
          : '포실이 단어장(한글) — 인쇄 창에서 PDF로 저장하세요',
        TOAST_TYPES.INFO,
      )
    } catch (error) {
      showToast(error.message || 'PDF 인쇄를 열 수 없습니다', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          토익 단어 공부
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          노랭이 단어모음 · 총 {toeicVocab.wordCount.toLocaleString()}단어 · DAY당{' '}
          {WORDS_PER_DAY}개 · DAY 1–{toeicVocab.dayCount}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-sky-200 bg-white p-0.5">
          {STUDY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setStudyMode(mode.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                studyMode === mode.id
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-600 hover:bg-sky-50'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {studyMode !== 'challenge' && (
          <>
            <p className="text-sm text-gray-600 ml-auto">
              <span className="font-semibold text-gray-800">DAY {selectedDay}</span>
              <span className="text-gray-400"> · </span>
              {words.length}단어
            </p>
            <button
              type="button"
              onClick={() => handlePrintPdf('en')}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              포실이 단어장 · 영어
            </button>
            <button
              type="button"
              onClick={() => handlePrintPdf('ko')}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-lime-200 bg-lime-50 text-lime-900 hover:bg-lime-100"
            >
              포실이 단어장 · 한글
            </button>
          </>
        )}
      </div>

      {studyMode !== 'challenge' && (
        <section className="mb-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Day 선택</h2>
            <span className="text-xs text-gray-500">DAY 1–{toeicVocab.dayCount}</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 max-h-48 overflow-y-auto p-1 rounded-xl border border-sky-100 bg-sky-50/40">
            {days.map((d) => {
              const active = d.day === selectedDay
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => handleSelectDay(d.day)}
                  className={`h-8 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white border border-sky-100 text-gray-700 hover:bg-sky-50'
                  }`}
                >
                  {d.day}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {studyMode === 'challenge' && (
        <ToeicDayChallengeGrid
          dayCount={toeicVocab.dayCount}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
        />
      )}

      {studyMode === 'list' && (
        <div className="rounded-xl border border-sky-100 bg-white overflow-hidden shadow-sm">
          <div className="max-h-[min(70vh,640px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sky-50 border-b border-sky-100">
                <tr className="text-left text-gray-600">
                  <th className="px-3 py-2.5 w-14 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">English</th>
                  <th className="px-3 py-2.5 font-semibold">한글</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word, index) => (
                  <tr
                    key={`${word.id}-${word.en}`}
                    className="border-b border-gray-50 hover:bg-sky-50/50"
                  >
                    <td className="px-3 py-2 text-gray-400 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {word.en}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{word.ko}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {studyMode === 'flash' && currentWord && (
        <div className="rounded-xl border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-sm text-gray-600">
              {flashIndex + 1} / {flashOrder.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowKoreanFirst((v) => !v)
                  setIsFlipped(false)
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
              >
                {showKoreanFirst ? '한글 → 영어' : '영어 → 한글'}
              </button>
              <button
                type="button"
                onClick={handleShuffle}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
              >
                섞기
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCardClick}
            className="w-full min-h-[220px] sm:min-h-[280px] rounded-2xl border-2 border-sky-200 bg-white shadow-md flex flex-col items-center justify-center px-6 py-10 text-center transition-transform active:scale-[0.99] hover:border-sky-300"
            aria-label={isFlipped ? '다음 단어' : '뜻 보기'}
          >
            <span className="text-xs uppercase tracking-wider text-sky-500 mb-3">
              {isFlipped
                ? '뜻 · 클릭하면 다음 단어'
                : '단어 · 클릭하면 뜻 보기'}
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug break-keep">
              {isFlipped ? backText : frontText}
            </span>
          </button>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50"
            >
              이전
            </button>
            <button
              type="button"
              onClick={goNext}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50"
            >
              다음
            </button>
          </div>

          <div className="mt-4 h-1.5 rounded-full bg-sky-100 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{
                width: `${((flashIndex + 1) / flashOrder.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
