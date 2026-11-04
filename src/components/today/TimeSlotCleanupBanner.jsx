/**
 * 지난 시간대에 남은 할 일 정리 배너
 * @param {Object} props
 * @param {string[]} props.pastLabels - 남은 할 일이 있는 지난 시간대 이름 (예: ['오전'])
 * @param {number} props.count - 남은 할 일 개수
 * @param {{ label: string, emoji: string }} props.currentSlot - 지금 시간대
 * @param {boolean} props.isWorking - 처리 중 여부
 * @param {Function} props.onMoveToCurrent - 지금 시간대로 옮기기
 * @param {Function} props.onMoveToBacklog - 백로그로 보내기
 * @param {Function} props.onDismiss - 닫기
 */
export default function TimeSlotCleanupBanner({
  pastLabels,
  count,
  currentSlot,
  isWorking,
  onMoveToCurrent,
  onMoveToBacklog,
  onDismiss,
}) {
  return (
    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
      <p className="text-base text-amber-900">
        ⏰ 지난 시간대({pastLabels.join(', ')})에 아직 못 끝낸 할 일이 <b>{count}개</b> 있어요.
      </p>
      <p className="text-sm text-amber-700 mt-1">
        미룰지, 오늘은 내려놓을지 정해두면 남은 하루가 가벼워져요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMoveToCurrent}
          disabled={isWorking}
          className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
        >
          {currentSlot.emoji} {currentSlot.label}로 미루기
        </button>
        <button
          type="button"
          onClick={onMoveToBacklog}
          disabled={isWorking}
          className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 disabled:opacity-50"
        >
          백로그로 보내기
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isWorking}
          className="px-3 py-1.5 rounded-lg text-amber-700 text-sm hover:bg-amber-100 disabled:opacity-50"
        >
          그대로 두기
        </button>
      </div>
    </div>
  )
}
