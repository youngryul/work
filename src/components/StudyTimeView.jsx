import { useEffect, useState } from 'react'
import {
  getStudySessionsByRange,
  getStudySecondsByDate,
  formatStudyDuration,
} from '../services/studyTimeService.js'
import ViewPageTitle from './ViewPageTitle.jsx'

const SOURCE_LABELS = {
  'summer-clock': '☀️ 여름 시계',
  pomodoro: '🍅 뽀모도로',
  unknown: '기타',
}

function sourceLabel(src) {
  return SOURCE_LABELS[src] || src
}

/**
 * 총 공부 시간을 막대로 시각화 (하루 최대 4시간 기준)
 */
function DayBar({ seconds, maxSeconds }) {
  const pct = maxSeconds > 0 ? Math.min(1, seconds / maxSeconds) : 0
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-green-500 transition-all duration-300"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}

/**
 * 월별 달력 뷰 (각 날짜에 공부 시간 표시)
 */
function MonthCalendar({ year, month, dayMap }) {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=일
  const lastDate = new Date(year, month, 0).getDate()
  const cells = []

  // 앞 빈칸
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)

  const today = new Date()
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? today.getDate()
      : null

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const secs = dayMap[dateStr] || 0
          const isToday = day === todayStr
          const hasStudy = secs > 0
          return (
            <div
              key={day}
              className={`rounded-lg p-1 text-center transition ${
                isToday ? 'ring-2 ring-green-400' : ''
              } ${hasStudy ? 'bg-green-50' : ''}`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday ? 'text-green-700 font-bold' : 'text-gray-600'
                }`}
              >
                {day}
              </span>
              {hasStudy && (
                <div className="mt-0.5 text-[9px] font-semibold text-green-700 leading-tight">
                  {formatStudyDurationShort(secs)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatStudyDurationShort(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (sec <= 0) return ''
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${sec}s`
}

/**
 * 공부 시간 일자별 통계 뷰
 */
export default function StudyTimeView() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthMap, setMonthMap] = useState({})
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [tab, setTab] = useState('list') // 'list' | 'calendar'

  useEffect(() => {
    setLoading(true)
    getStudySessionsByRange(6)
      .then((data) => setSessions(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    getStudySecondsByDate(calYear, calMonth)
      .then(setMonthMap)
      .catch(console.error)
  }, [calYear, calMonth])

  // 전체 합계
  const totalSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0)
  const maxDay = sessions.reduce((m, s) => Math.max(m, s.seconds), 0)

  const prevMonth = () => {
    if (calMonth === 1) {
      setCalYear((y) => y - 1)
      setCalMonth(12)
    } else {
      setCalMonth((m) => m - 1)
    }
  }
  const nextMonth = () => {
    const now = new Date()
    if (calYear === now.getFullYear() && calMonth === now.getMonth() + 1) return
    if (calMonth === 12) {
      setCalYear((y) => y + 1)
      setCalMonth(1)
    } else {
      setCalMonth((m) => m + 1)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <ViewPageTitle icon="📊" title="공부 시간 통계" />

      {/* 요약 카드 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs text-green-700 font-medium mb-1">최근 6개월 총</p>
          <p className="text-xl font-bold text-green-800">
            {loading ? '...' : formatStudyDuration(totalSeconds)}
          </p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs text-amber-700 font-medium mb-1">총 기록일</p>
          <p className="text-xl font-bold text-amber-800">
            {loading ? '...' : `${sessions.length}일`}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="mt-5 flex rounded-xl bg-gray-100 p-1">
        {[
          { key: 'list', label: '📋 목록' },
          { key: 'calendar', label: '📅 달력' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === key ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 목록 탭 */}
      {tab === 'list' && (
        <div className="mt-4 space-y-2">
          {loading && (
            <p className="text-center text-gray-400 py-8 text-sm">불러오는 중...</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              아직 기록이 없어요.<br />뽀모도로나 여름 시계 타이머를 사용해보세요!
            </p>
          )}
          {sessions.map((s) => (
            <div
              key={s.date}
              className="bg-white rounded-2xl px-4 py-3 shadow-sm flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{s.date}</span>
                <span className="text-sm font-bold text-green-700">
                  {formatStudyDuration(s.seconds)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DayBar seconds={s.seconds} maxSeconds={Math.max(maxDay, 3600)} />
              </div>
              {/* 소스별 breakdown */}
              {Object.keys(s.sources).length > 1 && (
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {Object.entries(s.sources).map(([src, secs]) => (
                    <span
                      key={src}
                      className="text-xs bg-gray-50 rounded-full px-2 py-0.5 text-gray-500"
                    >
                      {sourceLabel(src)} {formatStudyDuration(secs)}
                    </span>
                  ))}
                </div>
              )}
              {Object.keys(s.sources).length === 1 && (
                <span className="text-xs text-gray-400">
                  {sourceLabel(Object.keys(s.sources)[0])}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 달력 탭 */}
      {tab === 'calendar' && (
        <div className="mt-4">
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 text-lg"
            >
              ‹
            </button>
            <span className="font-semibold text-gray-700">
              {calYear}년 {calMonth}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 text-lg"
            >
              ›
            </button>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <MonthCalendar year={calYear} month={calMonth} dayMap={monthMap} />
          </div>
          {/* 이번 달 합계 */}
          <div className="mt-3 text-center text-sm text-gray-500">
            {calMonth}월 합계:{' '}
            <span className="font-bold text-green-700">
              {formatStudyDuration(Object.values(monthMap).reduce((s, v) => s + v, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
