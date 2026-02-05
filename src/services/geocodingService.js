/**
 * 주소를 좌표로 변환하는 서비스 (Geocoding)
 * 카카오맵 JavaScript API의 좌표 변환 기능 사용
 */

/**
 * 카카오맵 JavaScript API 로드
 */
function loadKakaoMapScript() {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      resolve()
      return
    }

    const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY
    if (!kakaoKey) {
      reject(new Error('카카오맵 API 키가 설정되지 않았습니다.'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false&libraries=services`
    script.onload = () => {
      window.kakao.maps.load(() => {
        resolve()
      })
    }
    script.onerror = () => {
      reject(new Error('카카오맵 스크립트 로드 실패'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 주소를 좌표로 변환
 * @param {string} address - 주소
 * @returns {Promise<{latitude: number, longitude: number}|null>} 좌표 정보
 */
export async function geocodeAddress(address) {
  if (!address || !address.trim()) {
    return null
  }

  try {
    const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY
    
    if (!kakaoKey) {
      throw new Error('카카오맵 API 키가 설정되지 않았습니다. VITE_KAKAO_MAP_KEY를 설정해주세요.')
    }

    // 카카오맵 JavaScript API 로드
    await loadKakaoMapScript()

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      throw new Error('카카오맵 API를 로드할 수 없습니다.')
    }

    // 주소 검색 서비스 사용
    const geocoder = new window.kakao.maps.services.Geocoder()

    return new Promise((resolve, reject) => {
      geocoder.addressSearch(address.trim(), (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          if (result && result.length > 0) {
            const firstResult = result[0]
            resolve({
              latitude: parseFloat(firstResult.y), // 카카오맵은 y가 위도
              longitude: parseFloat(firstResult.x), // 카카오맵은 x가 경도
            })
          } else {
            console.warn('주소를 찾을 수 없습니다:', address)
            resolve(null)
          }
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          console.warn('주소를 찾을 수 없습니다:', address)
          resolve(null)
        } else if (status === window.kakao.maps.services.Status.ERROR) {
          reject(new Error('주소 검색 중 오류가 발생했습니다.'))
        } else {
          reject(new Error(`주소 검색 실패: ${status}`))
        }
      })
    })
  } catch (error) {
    console.error('주소 변환 오류:', error)
    
    // 네트워크 오류
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    }
    
    // 이미 처리된 에러는 그대로 throw
    if (error.message && (error.message.includes('지도 API') || error.message.includes('API 키') || error.message.includes('제한'))) {
      throw error
    }
    
    // 기타 오류
    throw new Error(`주소 변환 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 장소 검색 (자동완성용)
 * @param {string} query - 검색어
 * @returns {Promise<Array<{placeName: string, address: string, latitude: number, longitude: number}>>} 검색 결과
 */
export async function searchPlaces(query) {
  if (!query || !query.trim() || query.trim().length < 2) {
    return []
  }

  try {
    const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY
    
    if (!kakaoKey) {
      throw new Error('카카오맵 API 키가 설정되지 않았습니다.')
    }

    // 카카오맵 JavaScript API 로드
    await loadKakaoMapScript()

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      throw new Error('카카오맵 API를 로드할 수 없습니다.')
    }

    // 장소 검색 서비스 사용
    const places = new window.kakao.maps.services.Places()

    return new Promise((resolve, reject) => {
      places.keywordSearch(query.trim(), (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const results = data.map(place => ({
            placeName: place.place_name,
            address: place.address_name || place.road_address_name || '',
            latitude: parseFloat(place.y),
            longitude: parseFloat(place.x),
            category: place.category_name,
            phone: place.phone || '',
          }))
          resolve(results)
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else if (status === window.kakao.maps.services.Status.ERROR) {
          reject(new Error('장소 검색 중 오류가 발생했습니다.'))
        } else {
          reject(new Error(`장소 검색 실패: ${status}`))
        }
      })
    })
  } catch (error) {
    console.error('장소 검색 오류:', error)
    return []
  }
}

/**
 * 여러 주소를 한번에 좌표로 변환
 * @param {Array<string>} addresses - 주소 배열
 * @returns {Promise<Array<{address: string, latitude: number, longitude: number}|null>>} 좌표 정보 배열
 */
export async function geocodeAddresses(addresses) {
  if (!addresses || addresses.length === 0) {
    return []
  }

  // 순차적으로 처리 (API 호출 제한 고려)
  const results = []
  for (const address of addresses) {
    const coords = await geocodeAddress(address)
    results.push(coords ? { address, ...coords } : null)
    // API 호출 제한을 고려하여 약간의 지연
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
