/**
 * 오늘 할 일 과부하 경고 배너 (평소 하루 처리량보다 훨씬 많이 쌓였을 때)
 * @param {Object} props
 * @param {number} props.pendingCount - 남은(미완료) 할 일 개수
 * @param {number} props.avgPerActiveDay - 최근 4주 동안 할 일을 끝낸 날의 하루 평균 완료 수
 * @param {number} props.movableCount - 백로그로 보낼 수 있는 '언제든' 할 일 개수 (핵심 제외)
 * @param {boolean} props.isWorking - 처리 중 여부
 * @param {Function} props.onMoveToBacklog - '언제든' 할 일 일부를 백로그로 보내기
 * @param {Function} props.onDismiss - 오늘은 그만 보기
 */
export default function TodayOverloadBanner({
  pendingCount,
  avgPerActiveDay,
  movableCount,
  isWorking,
  onMoveToBacklog,
  onDismiss,
}) {
  const excess = Math.max(1, Math.round(pendingCount - avgPerActiveDay))

  return (
    <div className="mb-4 rounded-xl bg-orange-50 border border-orange-200 p-4 shadow-sm" role="status">
      <p className="text-base text-orange-900">
        📦 남은 할 일이 <b>{pendingCount}개</b>예요. 최근 4주 동안 일한 날엔 하루 평균{' '}
        <b>{avgPerActiveDay}개</b>를 끝냈어요.
      </p>
      <p className="text-sm text-orange-800 mt-1">
        {excess}개 정도는 백로그로 보내거나 다른 날로 예약해 두면 오늘이 훨씬 가벼워져요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {movableCount > 0 && (
          <button
            type="button"
            onClick={onMoveToBacklog}
            disabled={isWorking}
            className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            🕒 &apos;언제든&apos; 할 일 {movableCount}개 백로그로
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          disabled={isWorking}
          className="px-3 py-1.5 rounded-lg text-orange-800 text-sm hover:bg-orange-100 disabled:opacity-50"
        >
          오늘은 그만 보기
        </button>
      </div>
    </div>
  )
}
