/**
 * 몸무게 변화 선 그래프 (SVG)
 */
import { WEIGHT_UNIT } from '../../constants/weightTracking.js'

/**
 * @param {{ records: Array<{ recordDate: string, weightKg: number }>, targetWeightKg?: number|null, height?: number }} props
 */
export default function WeightChart({ records, targetWeightKg = null, height = 220 }) {
  const sorted = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate))

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-white/60 text-gray-500 text-sm"
        style={{ height }}
      >
        기록이 쌓이면 그래프가 그려져요
      </div>
    )
  }

  const padding = { top: 20, right: 24, bottom: 32, left: 44 }
  const width = 640
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const weights = sorted.map((r) => r.weightKg)
  const allValues = targetWeightKg ? [...weights, targetWeightKg] : weights
  const minW = Math.min(...allValues)
  const maxW = Math.max(...allValues)
  const range = maxW - minW || 1
  const yMin = minW - range * 0.1
  const yMax = maxW + range * 0.1
  const yRange = yMax - yMin

  const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : 0

  const points = sorted.map((record, i) => {
    const x = padding.left + (sorted.length > 1 ? i * xStep : chartW / 2)
    const y = padding.top + chartH - ((record.weightKg - yMin) / yRange) * chartH
    return { x, y, ...record }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const areaPath = [
    linePath,
    `L ${points[points.length - 1].x} ${padding.top + chartH}`,
    `L ${points[0].x} ${padding.top + chartH}`,
    'Z',
  ].join(' ')

  const targetY = targetWeightKg
    ? padding.top + chartH - ((targetWeightKg - yMin) / yRange) * chartH
    : null

  const yTicks = 4
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => {
    return Math.round((yMin + (yRange * i) / yTicks) * 10) / 10
  })

  const labelIndices = new Set()
  if (sorted.length <= 5) {
    sorted.forEach((_, i) => labelIndices.add(i))
  } else {
    labelIndices.add(0)
    labelIndices.add(sorted.length - 1)
    labelIndices.add(Math.floor(sorted.length / 2))
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px]"
        role="img"
        aria-label="몸무게 변화 그래프"
      >
        <defs>
          <linearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTickValues.map((val) => {
          const y = padding.top + chartH - ((val - yMin) / yRange) * chartH
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#fed7aa"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-orange-400 text-[10px]"
              >
                {val}
              </text>
            </g>
          )
        })}

        {targetY !== null && (
          <g>
            <line
              x1={padding.left}
              y1={targetY}
              x2={width - padding.right}
              y2={targetY}
              stroke="#22c55e"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text
              x={width - padding.right}
              y={targetY - 6}
              textAnchor="end"
              className="fill-green-600 text-[10px] font-semibold"
            >
              목표 {targetWeightKg}{WEIGHT_UNIT}
            </text>
          </g>
        )}

        <path d={areaPath} fill="url(#weightAreaGradient)" />
        <path
          d={linePath}
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={p.recordDate}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#f97316" strokeWidth="2.5" />
            {labelIndices.has(i) && (
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-gray-500 text-[9px]"
              >
                {p.recordDate.slice(5).replace('-', '/')}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
