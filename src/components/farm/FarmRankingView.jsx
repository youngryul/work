import { useEffect, useState } from 'react'
import { FARM_DEFAULT_IMAGES, getFarmDisplayImage } from '../../constants/farm.js'
import { getFarmRanking } from '../../services/farmService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/** @type {Record<1|2|3, { card: string, crown: string, badge: string, crownLabel: string }>} */
const PODIUM_BY_RANK = {
  1: {
    card: 'bg-[#d8ecff] pt-8 pb-5 min-h-[220px]',
    crown: 'text-amber-400',
    badge: 'bg-orange-400 text-white',
    crownLabel: '1',
  },
  2: {
    card: 'bg-[#e8e8ec] pt-6 pb-4 min-h-[190px] mt-6',
    crown: 'text-slate-300',
    badge: 'bg-slate-500 text-white',
    crownLabel: '2',
  },
  3: {
    card: 'bg-[#f8d7e2] pt-6 pb-4 min-h-[175px] mt-10',
    crown: 'text-amber-700',
    badge: 'bg-amber-700 text-white',
    crownLabel: '3',
  },
}

/**
 * @param {{ stage: number, activeCharacter: object | null }} entry
 */
function getRankImage(entry) {
  return getFarmDisplayImage(entry.stage, {}, entry.activeCharacter)
}

/**
 * @param {{ entry: object | null, rank: 1|2|3 }} props
 */
function PodiumSlot({ entry, rank }) {
  const style = PODIUM_BY_RANK[rank]

  if (!entry) {
    return <div className="min-h-[120px]" aria-hidden />
  }

  const imageUrl = getRankImage(entry) || FARM_DEFAULT_IMAGES[1]

  return (
    <div className="relative flex flex-col items-stretch">
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-center z-10 pointer-events-none">
        <span className={`text-2xl ${style.crown}`} aria-hidden="true">
          👑
        </span>
        <span className="block text-xs font-bold text-white -mt-1">{style.crownLabel}</span>
      </div>
      <div
        className={`rounded-2xl px-2 ${style.card} text-center shadow-lg flex-1 ${
          entry.isMe ? 'ring-2 ring-yellow-300' : ''
        }`}
      >
        <img
          src={imageUrl}
          alt=""
          className="mx-auto w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow"
          draggable={false}
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = FARM_DEFAULT_IMAGES[1]
          }}
        />
        <p className="mt-2 text-[11px] sm:text-xs font-semibold text-gray-800 truncate px-1">
          {entry.isMe ? '나' : entry.displayName}
        </p>
        <p className="mt-1 text-sm sm:text-base font-extrabold text-rose-500 tabular-nums">
          +{(Number(entry.xp) || 0).toLocaleString()} XP
        </p>
        <span
          className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}
        >
          {entry.stage}단계
        </span>
      </div>
    </div>
  )
}

/**
 * 포실이 성장 랭킹 (Top3 포디움: 2위 | 1위 | 3위 + 4위부터 목록)
 */
export default function FarmRankingView({ onClose }) {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const data = await getFarmRanking(50)
        if (!cancelled) setEntries(data)
      } catch (error) {
        if (!cancelled) {
          showToast(
            error?.message || '랭킹을 불러오지 못했어요. SQL 적용 여부를 확인해 주세요.',
            TOAST_TYPES.ERROR,
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = [...entries].sort((a, b) => (a.rank || 0) - (b.rank || 0))
  const first = sorted.find((e) => e.rank === 1) ?? sorted[0] ?? null
  const second = sorted.find((e) => e.rank === 2) ?? sorted[1] ?? null
  const third = sorted.find((e) => e.rank === 3) ?? sorted[2] ?? null
  const rest = sorted.filter((e) => (e.rank || 0) >= 4)

  return (
    <div className="fixed inset-0 z-[180] bg-[#12141a] text-white overflow-y-auto font-sans">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#12141a]/60 backdrop-blur-md border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
        >
          ← 뒤로
        </button>
        <h2 className="text-base font-bold">포실이 성장 랭킹</h2>
        <span className="w-14" />
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10 pt-4">
        {isLoading ? (
          <p className="text-center text-white/50 py-16">랭킹을 불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-white/50 py-16">
            아직 랭킹 데이터가 없어요. 포실이를 키워보세요!
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 items-end mb-8">
              <PodiumSlot entry={second} rank={2} />
              <PodiumSlot entry={first} rank={1} />
              <PodiumSlot entry={third} rank={3} />
            </div>

            {rest.length > 0 ? (
              <div className="space-y-2">
                {rest.map((entry) => {
                  const imageUrl = getRankImage(entry) || FARM_DEFAULT_IMAGES[1]
                  return (
                    <div
                      key={entry.userId || entry.rank}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                        entry.isMe ? 'bg-yellow-500/15 ring-1 ring-yellow-400/40' : 'bg-white/5'
                      }`}
                    >
                      <div className="w-10 text-center shrink-0">
                        <p className="text-xl font-bold tabular-nums leading-none">{entry.rank}</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/10 text-white/70">
                          {entry.stage}단계
                        </span>
                      </div>
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-11 h-11 rounded-full object-contain bg-white/10 p-0.5 shrink-0"
                        draggable={false}
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = FARM_DEFAULT_IMAGES[1]
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {entry.isMe ? '나' : entry.displayName}
                        </p>
                        {entry.activeCharacter?.name && (
                          <p className="text-[11px] text-white/50 truncate">
                            {entry.activeCharacter.name}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-rose-400 tabular-nums shrink-0">
                        +{(Number(entry.xp) || 0).toLocaleString()} XP
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <p className="mt-6 text-center text-[11px] text-white/40">
              정렬: 성장 단계 → 현재 단계 XP (높은 순)
            </p>
          </>
        )}
      </div>
    </div>
  )
}
