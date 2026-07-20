/**
 * 수확 완료 모달
 * @param {Object} props
 * @param {boolean} props.open
 * @param {number} props.cropCount
 * @param {Array} props.previewCrops
 * @param {boolean} props.isHarvesting
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export default function FarmHarvestModal({
  open,
  cropCount,
  previewCrops,
  isHarvesting,
  onConfirm,
  onClose,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-amber-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-100 to-green-100 px-6 py-5 text-center">
          <span className="text-5xl block mb-2" aria-hidden>
            🎉
          </span>
          <h2 className="text-2xl font-bold text-green-900 font-handwriting">수확 이벤트!</h2>
          <p className="text-gray-700 mt-2 font-sans text-sm">
            밭의 작물 {cropCount}개가 모두 자랐어요.
            <br />
            수확하면 창고에 보관돼요.
          </p>
        </div>

        {previewCrops?.length > 0 && (
          <ul className="px-6 py-4 flex flex-wrap gap-3 justify-center max-h-40 overflow-y-auto">
            {previewCrops.map((item, index) => (
              <li
                key={`${item.cropGachaCharacterId}-${index}`}
                className="flex flex-col items-center gap-1 w-16"
              >
                {item.cropImageUrl ? (
                  <img src={item.cropImageUrl} alt="" className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-3xl">🌽</span>
                )}
                <span className="text-xs text-gray-600 truncate w-full text-center">
                  {item.cropName || '작물'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isHarvesting}
            className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isHarvesting}
            className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50 shadow-md"
          >
            {isHarvesting ? '수확 중…' : '🌾 수확하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
