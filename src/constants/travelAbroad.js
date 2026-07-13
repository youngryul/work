import { getAllCountries } from './countries.js'

/**
 * 해외 여행 국가별 시차·통화 매핑
 * @type {Record<string, { timeZone: string, currencyCode: string, naverFxCode?: string, currencyLabel: string }>}
 */
export const TRAVEL_ABROAD_META = {
  JP: { timeZone: 'Asia/Tokyo', currencyCode: 'JPY', naverFxCode: 'FX_JPYKRW', currencyLabel: '엔' },
  US: { timeZone: 'America/New_York', currencyCode: 'USD', naverFxCode: 'FX_USDKRW', currencyLabel: '달러' },
  CN: { timeZone: 'Asia/Shanghai', currencyCode: 'CNY', naverFxCode: 'FX_CNYKRW', currencyLabel: '위안' },
  HK: { timeZone: 'Asia/Hong_Kong', currencyCode: 'HKD', currencyLabel: '홍콩달러' },
  TW: { timeZone: 'Asia/Taipei', currencyCode: 'TWD', currencyLabel: '대만달러' },
  SG: { timeZone: 'Asia/Singapore', currencyCode: 'SGD', currencyLabel: '싱가포르달러' },
  TH: { timeZone: 'Asia/Bangkok', currencyCode: 'THB', currencyLabel: '바트' },
  VN: { timeZone: 'Asia/Ho_Chi_Minh', currencyCode: 'VND', currencyLabel: '동' },
  PH: { timeZone: 'Asia/Manila', currencyCode: 'PHP', currencyLabel: '페소' },
  MY: { timeZone: 'Asia/Kuala_Lumpur', currencyCode: 'MYR', currencyLabel: '링깃' },
  ID: { timeZone: 'Asia/Jakarta', currencyCode: 'IDR', currencyLabel: '루피아' },
  IN: { timeZone: 'Asia/Kolkata', currencyCode: 'INR', currencyLabel: '루피' },
  AE: { timeZone: 'Asia/Dubai', currencyCode: 'AED', currencyLabel: '디르함' },
  TR: { timeZone: 'Europe/Istanbul', currencyCode: 'TRY', currencyLabel: '리라' },
  GB: { timeZone: 'Europe/London', currencyCode: 'GBP', currencyLabel: '파운드' },
  FR: { timeZone: 'Europe/Paris', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  DE: { timeZone: 'Europe/Berlin', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  IT: { timeZone: 'Europe/Rome', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  ES: { timeZone: 'Europe/Madrid', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  NL: { timeZone: 'Europe/Amsterdam', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  BE: { timeZone: 'Europe/Brussels', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  CH: { timeZone: 'Europe/Zurich', currencyCode: 'CHF', currencyLabel: '프랑' },
  AT: { timeZone: 'Europe/Vienna', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  PT: { timeZone: 'Europe/Lisbon', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  GR: { timeZone: 'Europe/Athens', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  IE: { timeZone: 'Europe/Dublin', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  CZ: { timeZone: 'Europe/Prague', currencyCode: 'CZK', currencyLabel: '코루나' },
  HU: { timeZone: 'Europe/Budapest', currencyCode: 'HUF', currencyLabel: '포린트' },
  PL: { timeZone: 'Europe/Warsaw', currencyCode: 'PLN', currencyLabel: '즈워티' },
  SE: { timeZone: 'Europe/Stockholm', currencyCode: 'SEK', currencyLabel: '크로나' },
  NO: { timeZone: 'Europe/Oslo', currencyCode: 'NOK', currencyLabel: '크로네' },
  DK: { timeZone: 'Europe/Copenhagen', currencyCode: 'DKK', currencyLabel: '크로네' },
  FI: { timeZone: 'Europe/Helsinki', currencyCode: 'EUR', naverFxCode: 'FX_EURKRW', currencyLabel: '유로' },
  AU: { timeZone: 'Australia/Sydney', currencyCode: 'AUD', currencyLabel: '호주달러' },
  NZ: { timeZone: 'Pacific/Auckland', currencyCode: 'NZD', currencyLabel: '뉴질랜드달러' },
  CA: { timeZone: 'America/Toronto', currencyCode: 'CAD', currencyLabel: '캐나다달러' },
  MX: { timeZone: 'America/Mexico_City', currencyCode: 'MXN', currencyLabel: '페소' },
  BR: { timeZone: 'America/Sao_Paulo', currencyCode: 'BRL', currencyLabel: '헤알' },
  AR: { timeZone: 'America/Argentina/Buenos_Aires', currencyCode: 'ARS', currencyLabel: '페소' },
  RU: { timeZone: 'Europe/Moscow', currencyCode: 'RUB', currencyLabel: '루블' },
  EG: { timeZone: 'Africa/Cairo', currencyCode: 'EGP', currencyLabel: '파운드' },
  ZA: { timeZone: 'Africa/Johannesburg', currencyCode: 'ZAR', currencyLabel: '랜드' },
  MO: { timeZone: 'Asia/Macau', currencyCode: 'MOP', currencyLabel: '파타카' },
  MN: { timeZone: 'Asia/Ulaanbaatar', currencyCode: 'MNT', currencyLabel: '투그릭' },
  KH: { timeZone: 'Asia/Phnom_Penh', currencyCode: 'KHR', currencyLabel: '리엘' },
  LA: { timeZone: 'Asia/Vientiane', currencyCode: 'LAK', currencyLabel: '킵' },
  MM: { timeZone: 'Asia/Yangon', currencyCode: 'MMK', currencyLabel: '짯' },
  NP: { timeZone: 'Asia/Kathmandu', currencyCode: 'NPR', currencyLabel: '루피' },
  LK: { timeZone: 'Asia/Colombo', currencyCode: 'LKR', currencyLabel: '루피' },
  MV: { timeZone: 'Indian/Maldives', currencyCode: 'MVR', currencyLabel: '루피야' },
  IL: { timeZone: 'Asia/Jerusalem', currencyCode: 'ILS', currencyLabel: '셰켈' },
  SA: { timeZone: 'Asia/Riyadh', currencyCode: 'SAR', currencyLabel: '리얄' },
  QA: { timeZone: 'Asia/Qatar', currencyCode: 'QAR', currencyLabel: '리얄' },
  KW: { timeZone: 'Asia/Kuwait', currencyCode: 'KWD', currencyLabel: '디나르' },
}

export const TRAVEL_ABROAD_FALLBACK = {
  timeZone: 'UTC',
  currencyCode: null,
  currencyLabel: null,
}

/**
 * @param {string} countryCode
 */
export function getTravelAbroadMeta(countryCode) {
  const code = (countryCode || '').toUpperCase()
  return TRAVEL_ABROAD_META[code] || { ...TRAVEL_ABROAD_FALLBACK }
}

/**
 * 해외 여행 선택용 국가 목록 (대한민국 제외)
 * @returns {Array<{code: string, name: string}>}
 */
export function getAbroadCountryOptions() {
  return getAllCountries()
    .filter((c) => c.code !== 'KR')
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/** 타임라인 슬롯 높이(px) */
export const ITINERARY_SLOT_HEIGHT_PX = 28

/** 30분 슬롯 개수 (00:00~23:30) */
export const ITINERARY_SLOT_COUNT = 48
