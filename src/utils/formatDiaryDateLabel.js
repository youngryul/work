/**
 * YYYY-MM-DD → 한국어 날짜 라벨
 * @param {string} dateString
 * @returns {string}
 */
export function formatDiaryDateLabel(dateString) {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}
