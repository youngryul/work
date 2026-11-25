import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { getGachaGradeMeta } from '../../constants/gachaGrades.js'
import { getFarmDisplayImage } from '../../constants/farm.js'
import { getFarmSettingsMap, getMyFarmProgress } from '../../services/farmService.js'
import { usePosiliLoadout } from '../../hooks/usePosiliLoadout.js'
import PosiliAvatar from '../posili/PosiliAvatar.jsx'
import PosiliDecorModal from '../posili/PosiliDecorModal.jsx'
import {
  getMyGachaCollection,
  getMyGachaPullCount,
  setActiveGachaCharacter,
} from '../../services/gachaService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import ViewPageTitle from '../ViewPageTitle.jsx'

/**
 * 마이페이지 — 뽑은 포실이 컬렉션 · 내 캐릭터 설정
 */
export default function MyPageView() {
  const { user } = useAuth()
  const [collection, setCollection] = useState([])
  const [totalPulls, setTotalPulls] = useState(0)
  const [activeCharacterId, setActiveCharacterId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settingId, setSettingId] = useState(null)
  const [farmStage, setFarmStage] = useState(1)
  const [farmSettings, setFarmSettings] = useState({})
  const [showDecor, setShowDecor] = useState(false)
  const { loadout: posiliLoadout } = usePosiliLoadout()

  const load = async () => {
    setLoading(true)
    try {
      const [items, count, progress, settings] = await Promise.all([
        getMyGachaCollection(),
        getMyGachaPullCount(),
        getMyFarmProgress(),
        getFarmSettingsMap().catch(() => ({})),
      ])
      setCollection(items)
      setTotalPulls(count)
      setActiveCharacterId(progress.activeCharacter?.characterId ?? null)
      setFarmStage(progress.stage ?? 1)
      setFarmSettings(settings || {})
    } catch {
      setCollection([])
      setTotalPulls(0)
      setActiveCharacterId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSetActive = async (characterId) => {
    if (settingId || activeCharacterId === characterId) return
    setSettingId(characterId)
    try {
      await setActiveGachaCharacter(characterId)
      setActiveCharacterId(characterId)
      showToast('내 캐릭터로 설정했어요! 포실이 성장 화면에 반영돼요.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '캐릭터 설정에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setSettingId(null)
    }
  }

  // 내 캐릭터를 바꾸면 컬렉션의 이미지로 바로 반영한다
  const activeCollectionItem = collection.find((item) => item.characterId === activeCharacterId)
  const myPosiliImage = getFarmDisplayImage(
    farmStage,
    farmSettings,
    activeCollectionItem ? { imageUrl: activeCollectionItem.imageUrl } : null,
  )

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <ViewPageTitle icon="👤" title="마이페이지">
        <p className="text-xl text-gray-600">
          {user?.email ? `${user.email}님의 ` : ''}포실이 컬렉션
        </p>
      </ViewPageTitle>

      {!loading && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border-2 border-green-200 bg-gradient-to-b from-sky-100 via-green-50 to-amber-50 p-5 shadow-sm sm:flex-row sm:gap-6">
          <PosiliAvatar
            characterImageUrl={myPosiliImage}
            loadout={posiliLoadout}
            sizeClassName="w-32 h-32 sm:w-36 sm:h-36"
          />
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold text-green-900">내 포실이</p>
            <p className="mt-1 text-sm text-gray-600">배경과 액자로 포실이를 꾸며 보세요. 꾸민 모습은 포실이 성장 화면에도 보여요.</p>
            <button
              type="button"
              onClick={() => setShowDecor(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-pink-200 bg-white/90 px-4 py-1.5 text-sm font-bold text-pink-700 shadow-sm hover:bg-pink-50"
            >
              🎀 꾸미기
            </button>
          </div>
        </div>
      )}

      {/* 열 때만 마운트해서 페이지 진입 시 불필요한 조회를 하지 않는다 */}
      {showDecor && (
        <PosiliDecorModal
          open
          onClose={() => setShowDecor(false)}
          characterImageUrl={myPosiliImage}
        />
      )}

      <p className="mt-4 text-sm text-gray-600 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
        뽑은 포실이 중 하나를 <strong>내 캐릭터</strong>로 설정하면 포실이 성장 화면(2단계 이상)에 표시돼요.
      </p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border-2 border-green-200 bg-white/80 p-4 text-center shadow-sm">
          <p className="text-sm text-gray-500">보유 종류</p>
          <p className="text-3xl font-bold text-green-600">{collection.length}</p>
        </div>
        <div className="rounded-xl border-2 border-pink-200 bg-white/80 p-4 text-center shadow-sm">
          <p className="text-sm text-gray-500">총 뽑기</p>
          <p className="text-3xl font-bold text-pink-600">{totalPulls}</p>
        </div>
        <div className="rounded-xl border-2 border-amber-200 bg-white/80 p-4 text-center shadow-sm col-span-2 sm:col-span-1">
          <p className="text-sm text-gray-500">레전드</p>
          <p className="text-3xl font-bold text-amber-600">
            {collection.filter((c) => c.grade === 'legendary').length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">로딩 중...</div>
      ) : collection.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 bg-white/50">
          <p className="text-4xl mb-3">🎰</p>
          <p className="text-lg text-gray-600 font-medium">아직 뽑은 포실이가 없어요</p>
          <p className="text-sm text-gray-400 mt-2">뽑기 가챠 메뉴에서 첫 포실이를 만나보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {collection.map((item) => {
            const gradeMeta = getGachaGradeMeta(item.grade)
            const isActive = activeCharacterId === item.characterId
            const isSetting = settingId === item.characterId

            return (
              <div
                key={item.characterId}
                className={`relative rounded-2xl border-2 bg-white p-3 shadow-md hover:shadow-lg transition-shadow ${
                  isActive
                    ? 'border-sky-400 ring-2 ring-sky-200'
                    : gradeMeta.colorClass.split(' ').find((c) => c.startsWith('border-')) || 'border-gray-200'
                }`}
              >
                {isActive && (
                  <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-sky-500 text-white text-xs font-bold">
                    내 캐릭터
                  </span>
                )}
                {item.count > 1 && (
                  <span className="absolute top-2 right-2 z-10 min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-bold text-center">
                    ×{item.count}
                  </span>
                )}
                <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden mb-2">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${gradeMeta.colorClass}`}
                >
                  {gradeMeta.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleSetActive(item.characterId)}
                  disabled={isActive || isSetting}
                  className={`mt-2 w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-sky-100 text-sky-700 cursor-default'
                      : 'bg-gray-100 text-gray-700 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50'
                  }`}
                >
                  {isSetting ? '설정 중…' : isActive ? '표시 중' : '내 캐릭터로'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
