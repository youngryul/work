import { DECOR_SLOTS, EMPTY_POSILI_LOADOUT } from '../../constants/posiliDecor.js'

/**
 * 부위별로 보여줄 이미지 결정 — previewOverride에 키가 있으면 착용 상태보다 우선 (입어보기용)
 * @param {string} slot
 * @param {Record<string, { imageUrl?: string } | null>} loadout
 * @param {Record<string, string|null>} previewOverride
 * @returns {string|null}
 */
function resolveLayerUrl(slot, loadout, previewOverride) {
  if (Object.prototype.hasOwnProperty.call(previewOverride, slot)) {
    return previewOverride[slot] || null
  }
  return loadout?.[slot]?.imageUrl || null
}

/**
 * 꾸민 포실이 — 배경 → 캐릭터 → 액자 순서로 레이어를 쌓는다
 * @param {Object} props
 * @param {string} props.characterImageUrl
 * @param {Record<string, { imageUrl?: string } | null>} [props.loadout]
 * @param {Record<string, string|null>} [props.previewOverride] 입어보기: { background: url|null }
 * @param {string} [props.sizeClassName] 바깥 정사각형 크기
 * @param {string} [props.characterSizeClassName] 캐릭터 크기 (바깥 상자 기준)
 * @param {string} [props.characterMotionClassName] 캐릭터에만 줄 애니메이션 (배경·액자는 고정)
 * @param {string} [props.alt]
 * @param {string} [props.className]
 */
export default function PosiliAvatar({
  characterImageUrl,
  loadout = EMPTY_POSILI_LOADOUT,
  previewOverride = {},
  sizeClassName = 'w-44 h-44 sm:w-52 sm:h-52',
  characterSizeClassName = 'w-[80%] h-[80%]',
  characterMotionClassName = '',
  alt = '포실이',
  className = '',
}) {
  const backgroundUrl = resolveLayerUrl(DECOR_SLOTS.BACKGROUND, loadout, previewOverride)
  const frameUrl = resolveLayerUrl(DECOR_SLOTS.FRAME, loadout, previewOverride)
  const isDecorated = Boolean(backgroundUrl || frameUrl)

  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-3xl select-none ${sizeClassName} ${
        isDecorated ? 'shadow-md ring-4 ring-white/70' : ''
      } ${className}`}
    >
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`flex items-center justify-center ${characterSizeClassName} ${characterMotionClassName}`}>
          {characterImageUrl && (
            <img
              src={characterImageUrl}
              alt={alt}
              draggable={false}
              className="h-full w-full object-contain drop-shadow-xl"
            />
          )}
        </div>
      </div>

      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
      )}
    </div>
  )
}
