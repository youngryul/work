/**
 * 오늘 할 일 시간대 섹션 (오전 / 오후 / 퇴근 후 / 언제든)
 * @param {Object} props
 * @param {{ key: string, label: string, emoji: string }} props.slot - 시간대 정보
 * @param {Array} props.tasks - 이 섹션에 표시할 미완료 할 일
 * @param {number} props.completedCount - 이 시간대에서 완료한 할 일 개수
 * @param {number} [props.carriedCount] - 이 시간대에서 다음 시간대로 넘긴 할 일 개수 (전체 개수에 포함)
 * @param {boolean} props.isCurrent - 지금 시간대인지
 * @param {boolean} props.isPast - 이미 지나간 시간대인지
 * @param {boolean} props.isCollapsed - 접힘 여부
 * @param {Function} props.onToggleCollapse - 접기/펼치기
 * @param {boolean} props.isDropTarget - 드래그 중 이 섹션 끝에 놓을 위치인지
 * @param {Function} props.onDragOverEnd - 섹션 빈 공간 드래그 오버
 * @param {Function} props.onDropEnd - 섹션 빈 공간(맨 끝)에 드롭
 * @param {(task: Object, index: number) => JSX.Element} props.renderTask - 할 일 렌더 함수
 */
export default function TimeSlotSection({
  slot,
  tasks,
  completedCount,
  carriedCount = 0,
  isCurrent,
  isPast,
  isCollapsed,
  onToggleCollapse,
  isDropTarget,
  onDragOverEnd,
  onDropEnd,
  renderTask,
}) {
  // 다음 시간대로 넘긴 할 일도 원래 계획했던 양이므로 전체에 포함 (예: 10개 중 7개 완료 → 7/10)
  const totalCount = tasks.length + completedCount + carriedCount

  return (
    <section
      onDragOver={onDragOverEnd}
      onDrop={onDropEnd}
      className={`rounded-xl p-3 transition-colors duration-200 ${
        isCurrent
          ? 'bg-green-50/90 ring-2 ring-green-300'
          : isPast
          ? 'bg-white/50'
          : 'bg-white/70'
      } ${isDropTarget ? 'ring-2 ring-green-400' : ''}`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-1 py-1 text-left"
        aria-expanded={!isCollapsed}
      >
        <span className="text-2xl" aria-hidden>
          {slot.emoji}
        </span>
        <span className={`text-lg font-semibold ${isPast ? 'text-gray-500' : 'text-gray-800'}`}>
          {slot.label}
        </span>
        {isCurrent && (
          <span className="text-xs font-semibold text-white bg-green-500 rounded-full px-2 py-0.5">
            지금
          </span>
        )}
        {totalCount > 0 && (
          <span className="text-sm text-gray-500 tabular-nums">
            {completedCount}/{totalCount}
          </span>
        )}
        <span className="ml-auto text-gray-400 text-sm" aria-hidden>
          {isCollapsed ? `${tasks.length}개 ▸` : '▾'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="mt-2 space-y-3">
          {tasks.length === 0 ? (
            <div
              className={`text-center text-sm py-3 rounded-lg border-2 border-dashed ${
                isDropTarget ? 'border-green-400 text-green-600' : 'border-gray-200 text-gray-400'
              }`}
            >
              {carriedCount > 0
                ? `남은 ${carriedCount}개는 다음 시간대로 넘겼어요`
                : completedCount > 0
                ? '이 시간대 할 일을 모두 끝냈어요! 🎉'
                : '할 일을 여기로 끌어다 놓으세요'}
            </div>
          ) : (
            tasks.map((task, index) => renderTask(task, index))
          )}
        </div>
      )}
    </section>
  )
}
