import { useEffect, useMemo, useState } from 'react'
import { formatStudyDuration } from '../services/studyTimeService.js'

/** 내년 다짐 저장 키 (기기별 localStorage) */
const resolutionStorageKey = (year) => `yearEndResolution:${year}`

/** 'YYYY-MM-DD' → 'M월 D일' */
function formatMonthDay(dateKey) {
  const [, month, day] = String(dateKey).split('-').map(Number)
  return `${month}월 ${day}일`
}

/** 큰 숫자 하나를 강조하는 블록 */
function BigNumber({ value, unit, caption }) {
  return (
    <div className="mb-5">
      <p className="font-sans font-extrabold leading-none">
        <span className="text-6xl">{value}</span>
        {unit && <span className="text-2xl ml-1">{unit}</span>}
      </p>
      {caption && <p className="text-sm text-white/80 font-sans mt-2">{caption}</p>}
    </div>
  )
}

/** 보조 지표 한 줄 */
function StatRow({ emoji, label, value }) {
  return (
    <div className="flex items-center justify-between bg-white/15 rounded-xl px-3 py-2 text-sm font-sans">
      <span className="text-white/85">
        <span className="mr-1.5">{emoji}</span>
        {label}
      </span>
      <span className="font-bold text-right ml-3 truncate max-w-[55%]">{value}</span>
    </div>
  )
}

/** 1~12월 미니 막대 차트 */
function MonthlyBars({ values }) {
  const max = Math.max(...values, 1)
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1 h-16">
        {values.map((value, index) => (
          <div
            key={index}
            className="flex-1 bg-white/70 rounded-t"
            style={{ height: `${Math.max((value / max) * 100, value > 0 ? 6 : 2)}%` }}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {values.map((_, index) => (
          <span key={index} className="flex-1 text-center text-[10px] text-white/70 font-sans">
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  )
}

function SlideTitle({ children }) {
  return <p className="text-sm font-semibold text-white/85 font-sans mb-3">{children}</p>
}

function OpeningSlide({ stats }) {
  return (
    <div className="text-center flex flex-col items-center justify-center h-full">
      <img
        src="/images/포실이.png"
        alt="포실이"
        className="w-28 h-28 object-contain mb-3 drop-shadow-xl select-none"
      />
      <p className="text-sm text-white/85 font-sans mb-1">{stats.year}년 연말정산</p>
      <h2 className="text-2xl font-extrabold font-sans mb-6">올해를 함께 돌아볼까요?</h2>
      <BigNumber value={stats.activeDays} unit="일" caption="올해 기록을 남긴 날" />
      {stats.longestStreak > 1 && (
        <p className="text-sm font-sans bg-white/15 rounded-full px-4 py-1.5">
          🔥 최장 <span className="font-bold">{stats.longestStreak}일</span> 연속으로 기록했어요
        </p>
      )}
    </div>
  )
}

function TaskSlide({ tasks }) {
  return (
    <div>
      <SlideTitle>✅ 할 일</SlideTitle>
      <BigNumber
        value={tasks.total.toLocaleString()}
        unit="개"
        caption={
          tasks.completionRate !== null
            ? `올해 만든 할 일의 ${tasks.completionRate}%를 해냈어요`
            : '올해 완료한 할 일'
        }
      />
      <div className="space-y-2">
        {tasks.topCategories.map((category, index) => (
          <StatRow
            key={category.name}
            emoji={category.emoji}
            label={`${index + 1}위 ${category.name}`}
            value={`${category.count}개`}
          />
        ))}
        {tasks.bestDay && (
          <StatRow
            emoji="🏆"
            label="하루 최다 완료"
            value={`${formatMonthDay(tasks.bestDay.date)} · ${tasks.bestDay.count}개`}
          />
        )}
        {tasks.bestWeekday && (
          <StatRow emoji="📅" label="가장 많이 해낸 요일" value={`${tasks.bestWeekday}요일`} />
        )}
        {tasks.longestWait && (
          <StatRow
            emoji="🐢"
            label={`${tasks.longestWait.days}일 만에 끝낸 일`}
            value={tasks.longestWait.title}
          />
        )}
      </div>
      <MonthlyBars values={tasks.monthly} />
    </div>
  )
}

function TimeSlide({ time }) {
  return (
    <div>
      <SlideTitle>⏱️ 집중 시간</SlideTitle>
      <div className="mb-5">
        <p className="text-4xl font-extrabold font-sans leading-tight">
          {formatStudyDuration(time.totalSeconds)}
        </p>
        <p className="text-sm text-white/80 font-sans mt-2">{time.focusDays}일 동안 타이머를 켰어요</p>
      </div>

      <div className="space-y-2">
        {time.categories.map((category) => (
          <div key={category.id} className="bg-white/15 rounded-xl px-3 py-2 font-sans">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-white/85">
                <span className="mr-1.5">{category.emoji}</span>
                {category.label}
              </span>
              <span className="font-bold">
                {formatStudyDuration(category.seconds)} · {category.percent}%
              </span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${category.percent}%` }} />
            </div>
          </div>
        ))}
        {time.bestDay && (
          <StatRow
            emoji="🏆"
            label="가장 오래 집중한 날"
            value={`${formatMonthDay(time.bestDay.date)} · ${formatStudyDuration(time.bestDay.seconds)}`}
          />
        )}
        {time.timeType && (
          <StatRow emoji={time.timeType.emoji} label={time.timeType.description} value={time.timeType.label} />
        )}
      </div>
      <MonthlyBars values={time.monthly} />
    </div>
  )
}

function DiarySlide({ diary }) {
  return (
    <div>
      <SlideTitle>📔 일기</SlideTitle>
      <BigNumber
        value={diary.count}
        unit="편"
        caption={
          diary.bestMonth
            ? `${diary.bestMonth.month}월에 가장 많이(${diary.bestMonth.value}편) 썼어요`
            : '올해 쓴 일기'
        }
      />

      {diary.topEmotions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {diary.topEmotions.map((emotion) => (
            <span key={emotion.name} className="bg-white/20 rounded-full px-3 py-1 text-xs font-sans">
              {emotion.name} <span className="font-bold">{emotion.count}</span>
            </span>
          ))}
        </div>
      )}

      {diary.gallery.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {diary.gallery.map((image) => (
            <div key={image.date} className="relative aspect-square rounded-lg overflow-hidden bg-white/15">
              <img src={image.url} alt={`${image.date} 일기`} loading="lazy" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/40 text-[10px] text-center font-sans py-0.5">
                {formatMonthDay(image.date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {diary.first && (
        <div className="bg-white/15 rounded-xl px-3 py-3 font-sans">
          <p className="text-xs text-white/75 mb-1">올해 첫 일기 · {formatMonthDay(diary.first.date)}</p>
          <p className="text-sm leading-relaxed">“{diary.first.sentence}”</p>
        </div>
      )}
    </div>
  )
}

function ClosingSlide({ stats, resolution, onResolutionChange }) {
  const { yearType, tasks, time, diary } = stats
  return (
    <div className="text-center flex flex-col items-center justify-center h-full">
      <p className="text-sm text-white/85 font-sans mb-2">{stats.year}년의 나는</p>
      <p className="text-5xl mb-2">{yearType.emoji}</p>
      <h2 className="text-3xl font-extrabold font-sans mb-2">{yearType.title}</h2>
      <p className="text-sm text-white/85 font-sans mb-5">{yearType.line}</p>

      <div className="grid grid-cols-3 gap-2 w-full mb-5 font-sans">
        <div className="bg-white/15 rounded-xl py-2.5">
          <p className="text-lg font-bold">{tasks.total.toLocaleString()}</p>
          <p className="text-[11px] text-white/75">완료한 할 일</p>
        </div>
        <div className="bg-white/15 rounded-xl py-2.5">
          <p className="text-lg font-bold">{Math.round(time.totalSeconds / 3600).toLocaleString()}시간</p>
          <p className="text-[11px] text-white/75">집중 시간</p>
        </div>
        <div className="bg-white/15 rounded-xl py-2.5">
          <p className="text-lg font-bold">{diary.count}</p>
          <p className="text-[11px] text-white/75">일기</p>
        </div>
      </div>

      <label className="w-full text-left font-sans">
        <span className="text-xs text-white/80">{stats.year + 1}년 한 줄 다짐</span>
        <input
          type="text"
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value)}
          maxLength={60}
          placeholder="내년의 나에게 한마디 남겨보세요"
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-white/60"
        />
      </label>
    </div>
  )
}

/**
 * 연말정산(올해 돌아보기) 스토리형 팝업
 * - 기록이 없는 영역의 장은 건너뛴다
 * @param {{ isOpen: boolean, stats: object|null, onClose: Function }} props
 */
export default function YearEndReviewModal({ isOpen, stats, onClose }) {
  const [index, setIndex] = useState(0)
  const [resolution, setResolution] = useState('')

  const slides = useMemo(() => {
    if (!stats) return []
    return [
      { key: 'opening', gradient: 'from-sky-400 to-indigo-500' },
      stats.tasks.total > 0 && { key: 'tasks', gradient: 'from-emerald-400 to-teal-600' },
      stats.time.totalSeconds > 0 && { key: 'time', gradient: 'from-orange-400 to-rose-500' },
      stats.diary.count > 0 && { key: 'diary', gradient: 'from-violet-400 to-fuchsia-600' },
      { key: 'closing', gradient: 'from-indigo-500 to-purple-700' },
    ].filter(Boolean)
  }, [stats])

  // 열릴 때 첫 장으로 되돌리고, 저장해 둔 다짐을 불러온다
  useEffect(() => {
    if (!isOpen || !stats) return
    setIndex(0)
    try {
      setResolution(localStorage.getItem(resolutionStorageKey(stats.year + 1)) || '')
    } catch {
      setResolution('')
    }
  }, [isOpen, stats])

  const isLast = index >= slides.length - 1

  const handleClose = () => {
    try {
      const key = resolutionStorageKey(stats.year + 1)
      const trimmed = resolution.trim()
      if (trimmed) localStorage.setItem(key, trimmed)
      else localStorage.removeItem(key)
    } catch {
      // localStorage를 쓸 수 없는 환경에서는 다짐 저장만 건너뛴다
    }
    onClose()
  }

  // 좌우 방향키로 넘기기 (다짐 입력 중에는 커서 이동을 방해하지 않음)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.target?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, slides.length])

  if (!isOpen || !stats || slides.length === 0) return null

  const slide = slides[Math.min(index, slides.length - 1)]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
      <div
        className={`relative w-full max-w-sm h-[640px] max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden text-white bg-gradient-to-br ${slide.gradient} flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-label={`${stats.year}년 연말정산`}
      >
        {/* 진행 표시 */}
        <div className="flex gap-1 px-4 pt-4">
          {slides.map((s, i) => (
            <div key={s.key} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
              <div className={`h-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>

        <button
          onClick={handleClose}
          className="absolute top-7 right-4 text-white/70 hover:text-white text-2xl leading-none z-10"
          aria-label="닫기"
        >
          ×
        </button>

        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
          {slide.key === 'opening' && <OpeningSlide stats={stats} />}
          {slide.key === 'tasks' && <TaskSlide tasks={stats.tasks} />}
          {slide.key === 'time' && <TimeSlide time={stats.time} />}
          {slide.key === 'diary' && <DiarySlide diary={stats.diary} />}
          {slide.key === 'closing' && (
            <ClosingSlide stats={stats} resolution={resolution} onResolutionChange={setResolution} />
          )}
        </div>

        <div className="flex gap-2 px-6 pb-6">
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold font-sans"
            >
              이전
            </button>
          )}
          <button
            onClick={isLast ? handleClose : () => setIndex((i) => i + 1)}
            className="flex-1 py-2.5 rounded-xl bg-white text-gray-800 hover:bg-white/90 transition-colors text-sm font-semibold font-sans"
          >
            {isLast ? `${stats.year}년 정산 완료!` : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
