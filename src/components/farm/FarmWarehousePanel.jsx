/**
 * 농장 창고 패널
 * @param {Object} props
 * @param {Array} props.warehouse
 * @param {number} props.totalCount
 */
export default function FarmWarehousePanel({ warehouse, totalCount }) {
  if (!warehouse?.length) {
    return (
      <section className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center">
        <p className="text-amber-900/70 font-sans text-sm">창고가 비어 있어요. 수확한 작물이 여기 쌓여요.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-amber-900 flex items-center gap-2">
          <span aria-hidden>🏚️</span> 창고
        </h2>
        <span className="text-sm text-amber-800 tabular-nums font-semibold">총 {totalCount}개</span>
      </div>
      <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {warehouse.map((item) => (
          <li
            key={item.cropGachaCharacterId}
            className="flex flex-col items-center bg-white/80 rounded-xl p-2 border border-amber-100 shadow-sm"
          >
            {item.cropImageUrl ? (
              <img src={item.cropImageUrl} alt="" className="w-12 h-12 object-contain" />
            ) : (
              <span className="text-3xl">🌽</span>
            )}
            <span className="text-xs font-medium text-gray-800 mt-1 truncate w-full text-center">
              {item.cropName}
            </span>
            <span className="text-sm font-bold text-amber-800 tabular-nums">×{item.quantity}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
