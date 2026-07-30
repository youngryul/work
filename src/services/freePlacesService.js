/**
 * 무료 장소 검색 (OpenStreetMap 기반 Photon API — API 키 불필요)
 * https://photon.komoot.io
 */

const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/'

/**
 * @typedef {{
 *   id: string,
 *   placeName: string,
 *   placeAddress: string,
 *   placeLat: number | null,
 *   placeLng: number | null,
 * }} FreePlaceSuggestion
 */

/**
 * @param {Record<string, unknown>} props
 * @returns {string}
 */
function buildAddress(props) {
  const parts = [
    props.housenumber,
    props.street,
    props.locality,
    props.district,
    props.city || props.town || props.village || props.county,
    props.state,
    props.country,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)

  // 중복 제거 (이름과 주소가 겹칠 때)
  return [...new Set(parts)].join(', ')
}

/**
 * @param {string} query
 * @param {{ countryCode?: string }} [options]
 * @returns {Promise<FreePlaceSuggestion[]>}
 */
export async function searchFreePlaces(query, options = {}) {
  const trimmed = (query || '').trim()
  if (trimmed.length < 2) return []

  // Photon은 lang=ko 미지원 → 넣으면 400. default/en만 허용
  const params = new URLSearchParams({
    q: trimmed,
    limit: '8',
    lang: 'default',
  })

  try {
    const response = await fetch(`${PHOTON_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      console.warn('무료 장소 검색 실패:', response.status, await response.text().catch(() => ''))
      return []
    }

    const data = await response.json()
    const features = Array.isArray(data?.features) ? data.features : []
    const countryFilter = (options.countryCode || '').trim().toLowerCase()

    /** @type {FreePlaceSuggestion[]} */
    const mapped = features
      .map((feature, index) => {
        const props = feature?.properties || {}
        const coords = feature?.geometry?.coordinates
        const lng = Array.isArray(coords) ? Number(coords[0]) : null
        const lat = Array.isArray(coords) ? Number(coords[1]) : null
        const placeName = String(props.name || props.street || trimmed).trim()
        const placeAddress = buildAddress(props)
        const countryCode = String(props.countrycode || '').toLowerCase()
        const id = [
          props.osm_type || 'n',
          props.osm_id || index,
          lat ?? '',
          lng ?? '',
        ].join(':')

        return {
          id,
          placeName,
          placeAddress: placeAddress || placeName,
          placeLat: Number.isFinite(lat) ? lat : null,
          placeLng: Number.isFinite(lng) ? lng : null,
          countryCode,
        }
      })
      .filter((item) => item.placeName)

    if (!countryFilter) return mapped
    const filtered = mapped.filter((item) => item.countryCode === countryFilter)
    // 국가 필터에 결과가 없으면 전체 결과로 폴백
    return filtered.length > 0 ? filtered : mapped
  } catch (error) {
    console.warn('무료 장소 검색 실패:', error)
    return []
  }
}
