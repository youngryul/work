/**
 * 일정 장소 정보로 구글 지도 검색/길찾기 URL을 만든다.
 * @param {{
 *   placeName?: string | null,
 *   placeAddress?: string | null,
 *   placeLat?: number | null,
 *   placeLng?: number | null,
 *   googlePlaceId?: string | null,
 * }} place
 * @returns {string | null}
 */
export function buildGoogleMapsSearchUrl(place) {
  if (!place) return null

  const lat = place.placeLat
  const lng = place.placeLng
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
  }

  if (place.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.googlePlaceId)}`
  }

  const query = [place.placeName, place.placeAddress]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ')

  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/**
 * @param {object} place
 * @returns {boolean}
 */
export function hasPlaceLocation(place) {
  return Boolean(buildGoogleMapsSearchUrl(place))
}
