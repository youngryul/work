/**
 * AI 이미지 생성 1회 비용 안내 (보유량과 분리 표시)
 * @param {{ cost: number, className?: string }} props
 */
export default function AiTokenGenerationCostNote({ cost, className = '' }) {
  return (
    <p className={`text-sm text-gray-500 font-sans ${className}`}>
      AI 이미지 생성 <span className="font-semibold text-gray-700">1회당 {cost}토큰</span>이 소모됩니다.
    </p>
  )
}
