/**
 * 대학원 시간표 (학기별, 월요일·목요일)
 */

export const GRADUATE_SEMESTER_STORAGE_KEY = 'graduate-timetable-semester'

/** 야간 2교시 공통 시간 (학기에서 재사용) */
const EVENING_TWO_PERIODS = [
  { id: 'period-1', startTime: '18:50', endTime: '20:20' },
  { id: 'period-2', startTime: '20:30', endTime: '22:00' },
]

/**
 * 학기별 시간표. 새 학기는 이 배열에 객체를 추가하면 선택 상자에 나타난다.
 * term: 1=1학기, 2=2학기
 */
export const GRADUATE_TIMETABLE_SEMESTERS = [
  {
    id: '2026-2',
    year: 2026,
    term: 2,
    label: '2026년 2학기',
    periods: EVENING_TWO_PERIODS,
    days: [
      {
        id: 'monday',
        weekday: 1,
        label: '월요일',
        classes: {
          'period-1': { name: '세계문학탐구', classroom: '공D602' },
          'period-2': { name: '철학적사고와태도', classroom: '공D405' },
        },
      },
      {
        id: 'thursday',
        weekday: 4,
        label: '목요일',
        classes: {
          'period-1': { name: '미래사회와공학', classroom: '공D602' },
          'period-2': { name: '융합인문공학전공 세미나II', classroom: '공D602' },
        },
      },
    ],
  },
]

/**
 * 학기 id로 시간표를 찾는다.
 * @param {string} semesterId
 * @returns {(typeof GRADUATE_TIMETABLE_SEMESTERS)[number] | undefined}
 */
export function getGraduateSemesterById(semesterId) {
  return GRADUATE_TIMETABLE_SEMESTERS.find((semester) => semester.id === semesterId)
}

/**
 * 선택 상자용 학기 목록 (최신 학기 먼저)
 * @returns {typeof GRADUATE_TIMETABLE_SEMESTERS}
 */
export function getGraduateSemesterOptions() {
  return [...GRADUATE_TIMETABLE_SEMESTERS].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.term - a.term
  })
}

/**
 * 현재 날짜가 해당 학기 기간인지 여부
 * 1학기: 3~7월, 2학기: 8~12월 및 이듬해 1~2월
 * @param {{ year: number, term: number }} semester
 * @param {Date} now
 * @returns {boolean}
 */
export function isCurrentGraduateSemester(semester, now) {
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (semester.term === 1) {
    return year === semester.year && month >= 3 && month <= 7
  }
  if (month >= 8) return year === semester.year
  return month <= 2 && year === semester.year + 1
}

/**
 * 기본 선택 학기 (진행 중인 학기, 없으면 최신 학기)
 * @param {Date} [now]
 * @returns {string}
 */
export function getDefaultGraduateSemesterId(now = new Date()) {
  const current = GRADUATE_TIMETABLE_SEMESTERS.find((semester) =>
    isCurrentGraduateSemester(semester, now),
  )
  if (current) return current.id
  return getGraduateSemesterOptions()[0]?.id ?? ''
}

/**
 * HH:mm을 분 단위로 변환한다.
 * @param {string} time
 * @returns {number}
 */
export function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * 교시 시간 범위 문자열
 * @param {{ startTime: string, endTime: string }} period
 * @returns {string}
 */
export function formatClassTimeRange(period) {
  return `${period.startTime} ~ ${period.endTime}`
}

/**
 * 현재 시각이 해당 교시 안인지 여부
 * @param {{ startTime: string, endTime: string }} period
 * @param {Date} now
 * @returns {boolean}
 */
export function isGraduateClassInProgress(period, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return (
    nowMinutes >= parseTimeToMinutes(period.startTime) &&
    nowMinutes <= parseTimeToMinutes(period.endTime)
  )
}
