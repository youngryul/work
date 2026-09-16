import { formatStudyDuration } from '../services/studyTimeService.js'

/**
 * 매월 1일, 지난 달 타이머·할일 통계를 포실이와 함께 보여주는 회고 팝업
 * @param {{ isOpen: boolean, period: string, totalSeconds: number, totalCompletedTasks: number, onClose: Function }} props
 */
export default function MonthlyStatsPopupModal({ isOpen, period, totalSeconds, totalCompletedTasks, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div
        className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 pt-0 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 text-2xl leading-none"
          aria-label="닫기"
        >
          ×
        </button>

        <img
          src="/images/포실이.png"
          alt="포실이"
          className="w-28 h-28 object-contain mx-auto -mt-4 mb-1 drop-shadow-xl select-none"
        />

        <h2 className="text-xl font-bold text-gray-800 font-sans mb-1">
          {period} 돌아보기
        </h2>
        <p className="text-sm text-gray-500 font-sans mb-5">
          포실이와 함께 지난 달을 정리해봤어요!
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-sky-50 border border-sky-100 rounded-2xl py-4 px-2">
            <p className="text-2xl mb-1">⏱️</p>
            <p className="text-xs text-gray-500 font-sans mb-1">총 타이머 시간</p>
            <p className="text-base font-bold text-sky-700 font-sans">
              {formatStudyDuration(totalSeconds)}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl py-4 px-2">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-xs text-gray-500 font-sans mb-1">완료한 할 일</p>
            <p className="text-base font-bold text-emerald-700 font-sans">
              {totalCompletedTasks}개
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-sky-400 text-white rounded-xl hover:bg-sky-500 transition-colors text-sm font-semibold font-sans"
        >
          확인했어요
        </button>
      </div>
    </div>
  )
}
