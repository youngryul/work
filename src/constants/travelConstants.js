/**
 * 여행 기록 시스템 상수
 */

/**
 * 동행 유형 상수
 */
export const COMPANION_TYPE = {
  ALONE: 'ALONE',
  FRIENDS: 'FRIENDS',
  FAMILY: 'FAMILY',
  COUPLE: 'COUPLE',
  OTHER: 'OTHER',
}

/**
 * 동행 유형 라벨 (한글)
 */
export const COMPANION_TYPE_LABEL = {
  [COMPANION_TYPE.ALONE]: '혼자',
  [COMPANION_TYPE.FRIENDS]: '친구',
  [COMPANION_TYPE.FAMILY]: '가족',
  [COMPANION_TYPE.COUPLE]: '연인',
  [COMPANION_TYPE.OTHER]: '기타',
}

/**
 * 동행 유형 아이콘
 */
export const COMPANION_TYPE_ICON = {
  [COMPANION_TYPE.ALONE]: '🚶',
  [COMPANION_TYPE.FRIENDS]: '👥',
  [COMPANION_TYPE.FAMILY]: '👨‍👩‍👧‍👦',
  [COMPANION_TYPE.COUPLE]: '💑',
  [COMPANION_TYPE.OTHER]: '👤',
}

/**
 * 장소 카테고리 상수
 */
export const PLACE_CATEGORY = {
  RESTAURANT: 'RESTAURANT',
  ATTRACTION: 'ATTRACTION',
  ACCOMMODATION: 'ACCOMMODATION',
  SHOPPING: 'SHOPPING',
  CAFE: 'CAFE',
  OTHER: 'OTHER',
}

/**
 * 장소 카테고리 라벨 (한글)
 */
export const PLACE_CATEGORY_LABEL = {
  [PLACE_CATEGORY.RESTAURANT]: '음식점',
  [PLACE_CATEGORY.ATTRACTION]: '관광지',
  [PLACE_CATEGORY.ACCOMMODATION]: '숙소',
  [PLACE_CATEGORY.SHOPPING]: '쇼핑',
  [PLACE_CATEGORY.CAFE]: '카페',
  [PLACE_CATEGORY.OTHER]: '기타',
}

/**
 * 장소 카테고리 아이콘
 */
export const PLACE_CATEGORY_ICON = {
  [PLACE_CATEGORY.RESTAURANT]: '🍽️',
  [PLACE_CATEGORY.ATTRACTION]: '🏛️',
  [PLACE_CATEGORY.ACCOMMODATION]: '🏨',
  [PLACE_CATEGORY.SHOPPING]: '🛍️',
  [PLACE_CATEGORY.CAFE]: '☕',
  [PLACE_CATEGORY.OTHER]: '📍',
}

/**
 * 한국 시/도 목록
 */
export const PROVINCES = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원도',
  '충청북도',
  '충청남도',
  '전라북도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
]

/**
 * 만족도 점수 범위
 */
export const SATISFACTION_SCORE_MIN = 1
export const SATISFACTION_SCORE_MAX = 5

/**
 * 평점 범위
 */
export const RATING_MIN = 1
export const RATING_MAX = 5

/**
 * 기본 감정 태그 목록
 */
export const DEFAULT_EMOTION_TAGS = [
  '행복',
  '평온',
  '설렘',
  '즐거움',
  '만족',
  '감동',
  '편안함',
  '신나',
  '여유',
  '추억',
]

/**
 * 여행 목적 태그 목록 (자주 사용되는 태그)
 */
export const COMMON_TRAVEL_PURPOSE_TAGS = [
  '휴양',
  '관광',
  '맛집 탐방',
  '쇼핑',
  '힐링',
  '데이트',
  '가족 여행',
  '친구 여행',
  '혼자 여행',
  '사진 촬영',
  '액티비티',
  '문화 체험',
  '야경 감상',
  '해변',
  '산',
  '도시 탐방',
]
