import { useEffect, useRef, useState } from 'react'
import { geocodeAddress } from '../../services/geocodingService.js'

/**
 * 여행 동선 지도 컴포넌트
 * 카카오맵 JavaScript API를 사용하여 지도 표시
 */
export default function TravelMap({ places }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const [isLoading, setIsLoading] = useState(true)
  const [geocodedPlaces, setGeocodedPlaces] = useState([])

  // 주소를 좌표로 변환
  useEffect(() => {
    const geocodePlaces = async () => {
      if (places.length === 0) {
        setGeocodedPlaces([])
        return
      }

      setIsLoading(true)
      const geocoded = await Promise.all(
        places.map(async (place) => {
          // 이미 좌표가 있으면 그대로 사용
          if (place.latitude && place.longitude) {
            return place
          }

          // 주소가 있으면 좌표로 변환
          if (place.address) {
            try {
              const coords = await geocodeAddress(place.address)
              if (coords) {
                return {
                  ...place,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }
              }
            } catch (error) {
              console.error('주소 변환 실패:', place.address, error)
            }
          }

          // 좌표도 주소도 없으면 그대로 반환
          return place
        })
      )

      setGeocodedPlaces(geocoded)
      setIsLoading(false)
    }

    geocodePlaces()
  }, [places])

  useEffect(() => {
    if (!mapContainer.current || geocodedPlaces.length === 0) {
      setIsLoading(false)
      return
    }

    const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY

    if (!kakaoKey) {
      console.error('카카오맵 API 키가 설정되지 않았습니다.')
      setIsLoading(false)
      return
    }

    // 카카오맵 JavaScript API 동적 로드
    const loadKakaoMap = () => {
      // 이미 로드되어 있으면 바로 초기화
      if (window.kakao && window.kakao.maps) {
        initializeMap()
        return
      }

      // 카카오맵 스크립트 로드
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`
      script.onload = () => {
        window.kakao.maps.load(() => {
          initializeMap()
        })
      }
      script.onerror = () => {
        console.error('카카오맵 스크립트 로드 실패')
        setIsLoading(false)
      }
      document.head.appendChild(script)
    }

    const initializeMap = () => {
      try {
        if (!window.kakao || !window.kakao.maps) {
          setIsLoading(false)
          return
        }

        // 좌표가 있는 장소만 필터링
        const placesWithCoords = geocodedPlaces.filter(p => p.latitude && p.longitude)
        
        if (placesWithCoords.length === 0) {
          setIsLoading(false)
          return
        }

        // 지도 중심점 계산
        const centerLat = placesWithCoords.reduce((sum, p) => sum + p.latitude, 0) / placesWithCoords.length
        const centerLng = placesWithCoords.reduce((sum, p) => sum + p.longitude, 0) / placesWithCoords.length

        // 지도 초기화
        const mapOption = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 6, // 확대 레벨
        }

        map.current = new window.kakao.maps.Map(mapContainer.current, mapOption)

        // 기존 마커 제거
        markers.current.forEach(marker => marker.setMap(null))
        markers.current = []

        // 마커 추가
        placesWithCoords.forEach((place, index) => {
          const position = new window.kakao.maps.LatLng(place.latitude, place.longitude)
          
          // 커스텀 마커 이미지 생성
          const markerImageSrc = 'data:image/svg+xml;base64,' + btoa(`
            <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="12" fill="#3b82f6" stroke="white" stroke-width="3"/>
              <text x="15" y="20" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${index + 1}</text>
            </svg>
          `)
          
          const imageSize = new window.kakao.maps.Size(30, 30)
          const markerImage = new window.kakao.maps.MarkerImage(markerImageSrc, imageSize)

          const marker = new window.kakao.maps.Marker({
            position: position,
            image: markerImage,
            map: map.current,
          })

          // 인포윈도우 생성
          const infoContent = `
            <div style="padding: 8px; min-width: 150px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${place.name}</div>
              ${place.address ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${place.address}</div>` : ''}
              ${place.rating ? `<div style="font-size: 12px; color: #f59e0b;">★ ${place.rating}/5</div>` : ''}
            </div>
          `
          
          const infowindow = new window.kakao.maps.InfoWindow({
            content: infoContent,
          })

          // 마커 클릭 시 인포윈도우 표시
          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(map.current, marker)
          })

          markers.current.push(marker)
        })

        // 경로 라인 추가 (방문 순서대로)
        if (placesWithCoords.length > 1) {
          const linePath = placesWithCoords.map(p => 
            new window.kakao.maps.LatLng(p.latitude, p.longitude)
          )

          const polyline = new window.kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 3,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.6,
            strokeStyle: 'solid',
          })

          polyline.setMap(map.current)
        }

        // 지도 범위 조정
        if (placesWithCoords.length > 0) {
          const bounds = new window.kakao.maps.LatLngBounds()
          placesWithCoords.forEach(place => {
            bounds.extend(new window.kakao.maps.LatLng(place.latitude, place.longitude))
          })
          map.current.setBounds(bounds)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('지도 초기화 오류:', error)
        setIsLoading(false)
      }
    }

    loadKakaoMap()

    // cleanup
    return () => {
      if (markers.current.length > 0) {
        markers.current.forEach(marker => marker.setMap(null))
        markers.current = []
      }
      if (map.current) {
        map.current = null
      }
    }
  }, [geocodedPlaces])

  if (places.length === 0) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">표시할 장소가 없습니다.</div>
      </div>
    )
  }

  const placesWithCoords = geocodedPlaces.filter(p => p.latitude && p.longitude)

  if (placesWithCoords.length === 0) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">
          {isLoading 
            ? '주소를 좌표로 변환하는 중...' 
            : '위치 정보(주소 또는 좌표)가 있는 장소가 없습니다.'}
        </div>
      </div>
    )
  }

  const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY
  if (!kakaoKey) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="mb-2">카카오맵 API 키가 설정되지 않았습니다.</div>
          <div className="text-sm">.env 파일에 VITE_KAKAO_MAP_KEY를 설정해주세요.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
          <div className="text-gray-500">지도를 불러오는 중...</div>
        </div>
      )}
      <div
        ref={mapContainer}
        className="w-full h-96 rounded-lg"
        style={{ minHeight: '400px' }}
      />
      <div className="mt-4 text-sm text-gray-600">
        💡 지도에 표시된 숫자는 방문 순서를 나타냅니다.
      </div>
    </div>
  )
}
