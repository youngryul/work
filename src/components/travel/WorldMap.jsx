import { useState, useEffect } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import { getCountryName } from '../../constants/countries.js'
import { getCountryCodeFromName } from '../../constants/countryNameToCode.js'
import {
  getVisitedCountryCodes,
  toggleVisitedCountry,
} from '../../services/visitedCountriesService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

/**
 * 세계 지도 컴포넌트
 * - ISO 국가 코드 기반 렌더링
 * - 국가 hover 시 이름 표시
 * - 클릭 시 방문 여부 토글
 * - 확대/축소 기능
 */
export default function WorldMap({ onCountryClick, visitedCountries: visitedCountriesProp }) {
  const [visitedCountries, setVisitedCountries] = useState(new Set())
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [position, setPosition] = useState({ coordinates: [0, 0], zoom: 1 })
  const [loading, setLoading] = useState(true)

  // 방문 국가 목록 로드
  const loadVisitedCountries = async () => {
    try {
      const codes = await getVisitedCountryCodes()
      setVisitedCountries(codes)
      setLoading(false)
    } catch (error) {
      console.error('방문 국가 로드 오류:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVisitedCountries()
  }, [])

  // prop으로 전달된 방문 국가 목록이 변경되면 업데이트
  useEffect(() => {
    if (visitedCountriesProp && Array.isArray(visitedCountriesProp)) {
      const codes = new Set(visitedCountriesProp.map(country => country.countryCode?.toUpperCase()))
      setVisitedCountries(codes)
    }
  }, [visitedCountriesProp])

  // 국가 코드 추출 헬퍼 함수
  const getCountryCodeFromGeo = (geo) => {
    // 1. ISO_A2 속성 확인
    let countryCode = geo.properties.ISO_A2 || 
                     geo.properties.ISO_A2_EH || 
                     geo.properties.ISO_A2_LONG ||
                     (geo.properties.ISO_A3 ? geo.properties.ISO_A3.substring(0, 2) : null)
    
    // 2. ISO_A3에서 ISO_A2로 변환 시도
    if (!countryCode && geo.properties.ISO_A3) {
      const iso3ToIso2 = {
        'KOR': 'KR', 'CHN': 'CN', 'JPN': 'JP', 'USA': 'US', 'GBR': 'GB',
        'FRA': 'FR', 'DEU': 'DE', 'ITA': 'IT', 'ESP': 'ES', 'NLD': 'NL',
        'BEL': 'BE', 'CHE': 'CH', 'AUT': 'AT', 'SWE': 'SE', 'NOR': 'NO',
        'DNK': 'DK', 'FIN': 'FI', 'POL': 'PL', 'PRT': 'PT', 'GRC': 'GR',
        'IRL': 'IE', 'CZE': 'CZ', 'HUN': 'HU', 'ROU': 'RO', 'BGR': 'BG',
        'HRV': 'HR', 'SVK': 'SK', 'SVN': 'SI', 'EST': 'EE', 'LVA': 'LV',
        'LTU': 'LT', 'LUX': 'LU', 'MLT': 'MT', 'CYP': 'CY', 'ISL': 'IS',
        'RUS': 'RU', 'UKR': 'UA', 'BLR': 'BY', 'MDA': 'MD', 'ALB': 'AL',
        'BIH': 'BA', 'MNE': 'ME', 'MKD': 'MK', 'SRB': 'RS', 'IND': 'IN',
        'IDN': 'ID', 'THA': 'TH', 'VNM': 'VN', 'PHL': 'PH', 'MYS': 'MY',
        'SGP': 'SG', 'MMR': 'MM', 'KHM': 'KH', 'LAO': 'LA', 'BRN': 'BN',
        'TLS': 'TL', 'AFG': 'AF', 'BGD': 'BD', 'BTN': 'BT', 'MDV': 'MV',
        'NPL': 'NP', 'PAK': 'PK', 'LKA': 'LK', 'KAZ': 'KZ', 'KGZ': 'KG',
        'TJK': 'TJ', 'TKM': 'TM', 'UZB': 'UZ', 'MNG': 'MN', 'PRK': 'KP',
        'TWN': 'TW', 'HKG': 'HK', 'MAC': 'MO', 'ARE': 'AE', 'BHR': 'BH',
        'IRQ': 'IQ', 'IRN': 'IR', 'ISR': 'IL', 'JOR': 'JO', 'KWT': 'KW',
        'LBN': 'LB', 'OMN': 'OM', 'PSE': 'PS', 'QAT': 'QA', 'SAU': 'SA',
        'SYR': 'SY', 'TUR': 'TR', 'YEM': 'YE', 'CAN': 'CA', 'MEX': 'MX',
        'BRA': 'BR', 'ARG': 'AR', 'CHL': 'CL', 'COL': 'CO', 'PER': 'PE',
        'VEN': 'VE', 'ECU': 'EC', 'BOL': 'BO', 'PRY': 'PY', 'URY': 'UY',
        'GUY': 'GY', 'SUR': 'SR', 'GUF': 'GF', 'FLK': 'FK', 'CUB': 'CU',
        'JAM': 'JM', 'HTI': 'HT', 'DOM': 'DO', 'PRI': 'PR', 'TTO': 'TT',
        'CRI': 'CR', 'PAN': 'PA', 'NIC': 'NI', 'HND': 'HN', 'SLV': 'SV',
        'GTM': 'GT', 'BLZ': 'BZ', 'AUS': 'AU', 'NZL': 'NZ', 'PNG': 'PG',
        'FJI': 'FJ', 'SLB': 'SB', 'VUT': 'VU', 'NCL': 'NC', 'PYF': 'PF',
        'ZAF': 'ZA', 'EGY': 'EG', 'KEN': 'KE', 'ETH': 'ET', 'NGA': 'NG',
        'GHA': 'GH', 'TZA': 'TZ', 'UGA': 'UG', 'RWA': 'RW', 'ZWE': 'ZW',
        'ZMB': 'ZM', 'MWI': 'MW', 'MOZ': 'MZ', 'MAR': 'MA', 'TUN': 'TN',
        'DZA': 'DZ', 'LBY': 'LY', 'SDN': 'SD', 'SSD': 'SS', 'SOM': 'SO',
        'DJI': 'DJ', 'ERI': 'ER', 'MDG': 'MG', 'MUS': 'MU', 'SYC': 'SC',
        'CMR': 'CM', 'GAB': 'GA', 'COG': 'CG', 'COD': 'CD', 'AGO': 'AO',
        'NAM': 'NA', 'BWA': 'BW', 'LSO': 'LS', 'SWZ': 'SZ', 'BDI': 'BI',
        'TCD': 'TD', 'NER': 'NE', 'MLI': 'ML', 'BFA': 'BF', 'SEN': 'SN',
        'GMB': 'GM', 'GNB': 'GW', 'GIN': 'GN', 'SLE': 'SL', 'LBR': 'LR',
        'CIV': 'CI', 'TGO': 'TG', 'BEN': 'BJ', 'MRT': 'MR', 'GRL': 'GL'
      }
      countryCode = iso3ToIso2[geo.properties.ISO_A3] || null
    }
    
    // 3. 국가 이름으로 매핑 시도 (world-atlas의 countries-110m.json은 name만 제공)
    if (!countryCode && geo.properties.name) {
      countryCode = getCountryCodeFromName(geo.properties.name)
    }
    
    return countryCode
  }

  // 국가 클릭 핸들러
  const handleCountryClick = async (geo) => {
    const countryCode = getCountryCodeFromGeo(geo)
    if (!countryCode) return

    try {
      const isVisited = await toggleVisitedCountry(countryCode)
      await loadVisitedCountries()
      
      if (onCountryClick) {
        onCountryClick(countryCode, isVisited)
      }
    } catch (error) {
      console.error('방문 국가 토글 오류:', error)
      showToast(`오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`, TOAST_TYPES.ERROR)
    }
  }

  // 확대/축소 핸들러
  const handleMoveEnd = (position) => {
    setPosition(position)
  }

  // 국가 스타일 결정
  const getCountryStyle = (geo) => {
    const countryCode = getCountryCodeFromGeo(geo)
    
    if (!countryCode) {
      // 국가 코드가 없는 경우 기본 스타일 반환
      return {
        default: {
          fill: '#e5e7eb',
          stroke: '#ffffff',
          strokeWidth: 0.5,
          outline: 'none',
          cursor: 'default',
        },
        hover: {
          fill: '#d1d5db',
          stroke: '#ffffff',
          strokeWidth: 0.5,
          outline: 'none',
          cursor: 'default',
        },
        pressed: {
          fill: '#9ca3af',
          stroke: '#ffffff',
          strokeWidth: 0.5,
          outline: 'none',
          cursor: 'default',
        },
      }
    }
    
    const upperCountryCode = countryCode.toUpperCase()
    const isVisited = visitedCountries.has(upperCountryCode)
    const isHovered = hoveredCountry === upperCountryCode

    return {
      default: {
        fill: isVisited ? '#22c55e' : '#e5e7eb', // 방문: 초록, 미방문: 회색
        stroke: '#ffffff',
        strokeWidth: 0.5,
        outline: 'none',
        cursor: 'pointer',
      },
      hover: {
        fill: isVisited ? '#16a34a' : '#d1d5db', // hover 시 약간 어둡게
        stroke: '#3b82f6',
        strokeWidth: 1.5,
        outline: 'none',
        cursor: 'pointer',
      },
      pressed: {
        fill: isVisited ? '#15803d' : '#9ca3af',
        stroke: '#2563eb',
        strokeWidth: 2,
        outline: 'none',
        cursor: 'pointer',
      },
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">지도를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Hover 시 국가명 표시 */}
      {hoveredCountry && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
          {getCountryName(hoveredCountry)}
        </div>
      )}

      {/* 확대/축소 컨트롤 */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => {
            setPosition((prev) => ({
              ...prev,
              zoom: Math.min(prev.zoom * 1.5, 8),
            }))
          }}
          className="bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-3 rounded shadow-md border border-gray-300"
          title="확대"
        >
          +
        </button>
        <button
          onClick={() => {
            setPosition((prev) => ({
              ...prev,
              zoom: Math.max(prev.zoom / 1.5, 1),
            }))
          }}
          className="bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-3 rounded shadow-md border border-gray-300"
          title="축소"
        >
          −
        </button>
        <button
          onClick={() => {
            setPosition({ coordinates: [0, 0], zoom: 1 })
          }}
          className="bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-3 rounded shadow-md border border-gray-300 text-xs"
          title="초기화"
        >
          ⌂
        </button>
      </div>

      {/* 범례 */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>방문한 국가</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span>미방문 국가</span>
          </div>
        </div>
      </div>

      {/* 지도 */}
      <ComposableMap
        projectionConfig={{
          scale: 147,
        }}
        width={800}
        height={600}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              return geographies.map((geo) => {
                const countryCode = getCountryCodeFromGeo(geo)
                const upperCountryCode = countryCode ? countryCode.toUpperCase() : null
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={getCountryStyle(geo)}
                    onMouseEnter={() => {
                      if (upperCountryCode) {
                        setHoveredCountry(upperCountryCode)
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredCountry(null)
                    }}
                    onClick={() => handleCountryClick(geo)}
                  />
                )
              })
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
