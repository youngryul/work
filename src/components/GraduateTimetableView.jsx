import { useEffect, useMemo, useState } from 'react'
import ViewPageTitle from './ViewPageTitle.jsx'
import {
  GRADUATE_SEMESTER_STORAGE_KEY,
  formatClassTimeRange,
  getDefaultGraduateSemesterId,
  getGraduateSemesterById,
  getGraduateSemesterOptions,
  isCurrentGraduateSemester,
  isGraduateClassInProgress,
} from '../constants/graduateTimetable.js'

/**
 * 저장된 학기 id를 읽고, 없으면 기본 학기를 반환한다.
 * @returns {string}
 */
function readStoredSemesterId() {
  const saved = localStorage.getItem(GRADUATE_SEMESTER_STORAGE_KEY)
  if (saved && getGraduateSemesterById(saved)) return saved
  return getDefaultGraduateSemesterId()
}

/**
 * 대학원 시간표 화면 (학기 선택, 월·목, 시간·과목명·강의실)
 */
export default function GraduateTimetableView() {
  const [now, setNow] = useState(() => new Date())
  const [selectedSemesterId, setSelectedSemesterId] = useState(readStoredSemesterId)
  const semesterOptions = useMemo(() => getGraduateSemesterOptions(), [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const selectedSemester = useMemo(
    () => getGraduateSemesterById(selectedSemesterId) ?? semesterOptions[0],
    [selectedSemesterId, semesterOptions],
  )
  const periods = selectedSemester?.periods ?? []
  const days = selectedSemester?.days ?? []
  const isSelectedSemesterCurrent = selectedSemester
    ? isCurrentGraduateSemester(selectedSemester, now)
    : false
  const todayWeekday = now.getDay()

  const handleSemesterChange = (event) => {
    const nextId = event.target.value
    setSelectedSemesterId(nextId)
    localStorage.setItem(GRADUATE_SEMESTER_STORAGE_KEY, nextId)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ViewPageTitle icon="🎓" title="대학원 시간표">
      </ViewPageTitle>

      <div className="mb-6">
        <label
          htmlFor="graduate-semester"
          className="block text-sm font-semibold text-gray-700 mb-2 font-sans"
        >
          학기
        </label>
        <select
          id="graduate-semester"
          value={selectedSemester?.id ?? ''}
          onChange={handleSemesterChange}
          className="w-full sm:w-64 px-4 py-2.5 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
        >
          {semesterOptions.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.label}
            </option>
          ))}
        </select>
      </div>

      {days.length === 0 ? (
        <p className="rounded-2xl border-2 border-green-100 bg-white px-4 py-8 text-center text-gray-500 font-sans">
          이 학기에 등록된 수업이 없습니다.
        </p>
      ) : (
        <>
          {/* 데스크톱: 시간 × 요일 표 */}
          <div className="hidden md:block overflow-hidden rounded-2xl border-2 border-green-100 bg-white shadow-md">
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr className="bg-green-50">
                  <th className="w-36 px-4 py-3 text-left text-sm font-semibold text-gray-500 border-b-2 border-green-100">
                    시간
                  </th>
                  {days.map((day) => {
                    const isToday = isSelectedSemesterCurrent && day.weekday === todayWeekday
                    return (
                      <th
                        key={day.id}
                        className={`px-4 py-3 text-left border-b-2 border-green-100 ${
                          isToday ? 'bg-green-100' : ''
                        }`}
                      >
                        <span className="text-lg font-bold text-gray-800">{day.label}</span>
                        {isToday && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                            오늘
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className="align-top">
                    <th className="px-4 py-5 text-left text-base font-semibold text-gray-600 border-t border-green-100 whitespace-nowrap">
                      {formatClassTimeRange(period)}
                    </th>
                    {days.map((day) => {
                      const course = day.classes[period.id]
                      const isToday = isSelectedSemesterCurrent && day.weekday === todayWeekday
                      const isNow = isToday && isGraduateClassInProgress(period, now)
                      return (
                        <td key={`${day.id}-${period.id}`} className="px-4 py-4 border-t border-green-100">
                          <ClassCard course={course} isNow={isNow} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일: 요일 카드 */}
          <div className="md:hidden space-y-4">
            {days.map((day) => {
              const isToday = isSelectedSemesterCurrent && day.weekday === todayWeekday
              return (
                <section
                  key={day.id}
                  className={`rounded-2xl border-2 bg-white shadow-md overflow-hidden ${
                    isToday ? 'border-green-400' : 'border-green-100'
                  }`}
                >
                  <header
                    className={`flex items-center gap-2 px-4 py-3 ${
                      isToday ? 'bg-green-100' : 'bg-green-50'
                    }`}
                  >
                    <h2 className="text-lg font-bold text-gray-800 font-sans">{day.label}</h2>
                    {isToday && (
                      <span className="inline-flex items-center rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                        오늘
                      </span>
                    )}
                  </header>
                  <ul className="divide-y divide-green-100">
                    {periods.map((period) => {
                      const course = day.classes[period.id]
                      const isNow = isToday && isGraduateClassInProgress(period, now)
                      return (
                        <li key={period.id} className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-500 font-sans mb-2">
                            {formatClassTimeRange(period)}
                          </p>
                          <ClassCard course={course} isNow={isNow} />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * 과목명·강의실 카드
 * @param {{ course?: { name: string, classroom: string }, isNow: boolean }} props
 */
function ClassCard({ course, isNow }) {
  if (!course) {
    return (
      <div className="rounded-xl px-4 py-3 font-sans bg-gray-50 text-gray-400">수업 없음</div>
    )
  }

  return (
    <div
      className={`rounded-xl px-4 py-3 font-sans ${
        isNow
          ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-300'
          : 'bg-green-50 text-gray-800'
      }`}
    >
      <p className="text-base font-bold leading-snug">{course.name}</p>
      <p className={`mt-1 text-sm ${isNow ? 'text-green-50' : 'text-gray-600'}`}>
        {course.classroom}
      </p>
      {isNow && (
        <p className="mt-2 text-xs font-semibold tracking-wide text-white/90">수업 중</p>
      )}
    </div>
  )
}
