/**
 * 가계부 상수
 */

/** 거래 유형 */
export const LEDGER_TRANSACTION_TYPES = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
  TRANSFER: 'TRANSFER',
  INVESTMENT: 'INVESTMENT',
}

/** 내역 추가용 거래 유형 (투자는 투자 탭에서만 추가) */
export const LEDGER_TRANSACTION_TYPE_OPTIONS = [
  { id: LEDGER_TRANSACTION_TYPES.EXPENSE, label: '지출' },
  { id: LEDGER_TRANSACTION_TYPES.INCOME, label: '수입' },
  { id: LEDGER_TRANSACTION_TYPES.TRANSFER, label: '이체' },
]

/** 내역 필터용 (기존 투자 거래 포함) */
export const LEDGER_TRANSACTION_FILTER_OPTIONS = [
  ...LEDGER_TRANSACTION_TYPE_OPTIONS,
  { id: LEDGER_TRANSACTION_TYPES.INVESTMENT, label: '투자' },
]

/** 카테고리 유형 (지출/수입) */
export const LEDGER_CATEGORY_TYPES = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
}

/** 계좌 유형 */
export const LEDGER_ACCOUNT_TYPES = {
  CASH: 'CASH',
  BANK: 'BANK',
  CARD: 'CARD',
  INVESTMENT: 'INVESTMENT',
  LOAN: 'LOAN',
}

export const LEDGER_ACCOUNT_TYPE_OPTIONS = [
  { id: LEDGER_ACCOUNT_TYPES.CASH, label: '현금' },
  { id: LEDGER_ACCOUNT_TYPES.BANK, label: '적금' },
  { id: LEDGER_ACCOUNT_TYPES.LOAN, label: '대출' },
]

/**
 * 자산 통화
 * exchangeCode: 네이버 환율 API 코드
 * quoteUnit: 환율이 N단위 기준일 때 (엔화는 보통 100엔)
 */
export const LEDGER_CURRENCIES = {
  KRW: 'KRW',
  USD: 'USD',
  JPY: 'JPY',
  EUR: 'EUR',
  CNY: 'CNY',
  VND: 'VND',
}

export const LEDGER_CURRENCY_OPTIONS = [
  {
    id: LEDGER_CURRENCIES.KRW,
    label: '원',
    unitLabel: '원',
    exchangeCode: null,
    quoteUnit: 1,
  },
  {
    id: LEDGER_CURRENCIES.USD,
    label: '달러',
    unitLabel: '달러',
    exchangeCode: 'FX_USDKRW',
    quoteUnit: 1,
  },
  {
    id: LEDGER_CURRENCIES.JPY,
    label: '엔',
    unitLabel: '엔',
    exchangeCode: 'FX_JPYKRW',
    quoteUnit: 100,
  },
  {
    id: LEDGER_CURRENCIES.EUR,
    label: '유로',
    unitLabel: '유로',
    exchangeCode: 'FX_EURKRW',
    quoteUnit: 1,
  },
  {
    id: LEDGER_CURRENCIES.CNY,
    label: '위안',
    unitLabel: '위안',
    exchangeCode: 'FX_CNYKRW',
    quoteUnit: 1,
  },
  {
    id: LEDGER_CURRENCIES.VND,
    label: '동',
    unitLabel: '동',
    exchangeCode: 'FX_VNDKRW',
    quoteUnit: 100,
  },
]

/** API 실패 시 대략 환산용 (1단위당 원) */
export const LEDGER_FALLBACK_KRW_RATES = {
  USD: 1350,
  JPY: 9,
  EUR: 1450,
  CNY: 190,
  VND: 0.055,
}

/**
 * @param {string} currency
 * @returns {typeof LEDGER_CURRENCY_OPTIONS[number]}
 */
export function getLedgerCurrencyOption(currency) {
  return (
    LEDGER_CURRENCY_OPTIONS.find((item) => item.id === currency) ||
    LEDGER_CURRENCY_OPTIONS[0]
  )
}

/**
 * @param {string} currency
 * @returns {string}
 */
export function getLedgerCurrencyUnitLabel(currency) {
  return getLedgerCurrencyOption(currency).unitLabel
}

/**
 * 외화 금액 표시 (예: 1,200달러)
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatLedgerForeignAmount(amount, currency) {
  const value = Math.abs(Number(amount) || 0)
  const unit = getLedgerCurrencyUnitLabel(currency)
  if (currency === LEDGER_CURRENCIES.KRW) {
    return `${value.toLocaleString('ko-KR')}원`
  }
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${unit}`
}

/** 투자 자산 종류 */
export const LEDGER_INVESTMENT_ASSET_TYPES = {
  DOMESTIC_STOCK: 'DOMESTIC_STOCK',
  OVERSEAS_STOCK: 'OVERSEAS_STOCK',
  ETF: 'ETF',
  PENSION: 'PENSION',
  COIN: 'COIN',
  OTHER: 'OTHER',
}

export const LEDGER_INVESTMENT_ASSET_TYPE_OPTIONS = [
  { id: LEDGER_INVESTMENT_ASSET_TYPES.DOMESTIC_STOCK, label: '국내주식' },
  { id: LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK, label: '해외주식' },
  { id: LEDGER_INVESTMENT_ASSET_TYPES.ETF, label: 'ETF' },
  { id: LEDGER_INVESTMENT_ASSET_TYPES.PENSION, label: '연금' },
  { id: LEDGER_INVESTMENT_ASSET_TYPES.COIN, label: '코인' },
  { id: LEDGER_INVESTMENT_ASSET_TYPES.OTHER, label: '기타' },
]

/** 해외주식 기록 통화 선택지 */
export const LEDGER_INVESTMENT_CURRENCY_OPTIONS = [
  { id: LEDGER_CURRENCIES.USD, label: '달러' },
  { id: LEDGER_CURRENCIES.KRW, label: '원' },
]

/**
 * 투자 기록 통화 결정 (레거시: 해외주식은 기본 달러)
 * @param {{ assetType?: string, currency?: string|null }} item
 * @returns {string}
 */
export function resolveLedgerInvestmentCurrency(item) {
  if (
    item?.currency === LEDGER_CURRENCIES.USD ||
    item?.currency === LEDGER_CURRENCIES.KRW
  ) {
    return item.currency
  }
  if (item?.assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK) {
    return LEDGER_CURRENCIES.USD
  }
  return LEDGER_CURRENCIES.KRW
}

/**
 * 종류에 따른 기본 기록 통화
 * @param {string} assetType
 * @returns {string}
 */
export function getDefaultLedgerInvestmentCurrency(assetType) {
  return assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK
    ? LEDGER_CURRENCIES.USD
    : LEDGER_CURRENCIES.KRW
}

/**
 * 달러 단위로 기록된 투자인지
 * @param {{ assetType?: string, currency?: string|null }|string} itemOrCurrency
 * @returns {boolean}
 */
export function isLedgerInvestmentUsd(itemOrCurrency) {
  if (typeof itemOrCurrency === 'string') {
    return itemOrCurrency === LEDGER_CURRENCIES.USD
  }
  return resolveLedgerInvestmentCurrency(itemOrCurrency) === LEDGER_CURRENCIES.USD
}

/**
 * 투자 금액 표기 (통화 기준)
 * @param {number} amount
 * @param {{ assetType?: string, currency?: string|null }|string} itemOrCurrency
 * @returns {string}
 */
export function formatLedgerInvestmentAmount(amount, itemOrCurrency) {
  const value = Number(amount) || 0
  if (isLedgerInvestmentUsd(itemOrCurrency)) {
    return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}달러`
  }
  return formatLedgerAmount(value)
}

/**
 * 투자 부호 금액 표기
 * @param {number} amount
 * @param {{ assetType?: string, currency?: string|null }|string} itemOrCurrency
 * @returns {string}
 */
export function formatLedgerInvestmentSignedAmount(amount, itemOrCurrency) {
  const value = Number(amount) || 0
  const asUsd = isLedgerInvestmentUsd(itemOrCurrency)
  const abs = Math.abs(value).toLocaleString('ko-KR', {
    maximumFractionDigits: asUsd ? 2 : 0,
  })
  const unit = asUsd ? '달러' : '원'
  if (value > 0) return `+${abs}${unit}`
  if (value < 0) return `-${abs}${unit}`
  return `0${unit}`
}

/** 가계부 탭 (분석은 맨 뒤) */
export const LEDGER_TABS = [
  { id: 'home', label: '홈' },
  { id: 'history', label: '내역' },
  { id: 'assets', label: '자산' },
  { id: 'investment', label: '투자' },
  { id: 'analysis', label: '분석' },
]

/** 분석 기간 단위 */
export const LEDGER_PERIOD_UNITS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
}

export const LEDGER_PERIOD_UNIT_TABS = [
  { id: LEDGER_PERIOD_UNITS.DAY, label: '일' },
  { id: LEDGER_PERIOD_UNITS.WEEK, label: '주' },
  { id: LEDGER_PERIOD_UNITS.MONTH, label: '월' },
]

/** 탭 공통 추가 버튼 스타일 */
export const LEDGER_ADD_BUTTON_CLASS =
  'px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors shrink-0'

/** 금액 빠른 추가 버튼 */
export const LEDGER_QUICK_AMOUNTS = [
  { label: '만원', value: 10_000 },
  { label: '십만원', value: 100_000 },
  { label: '백만원', value: 1_000_000 },
  { label: '천만원', value: 10_000_000 },
]

/**
 * 입력용 금액 문자열에 천단위 쉼표 적용
 * @param {string|number} value
 * @returns {string}
 */
export function formatLedgerAmountInput(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
}

/**
 * 쉼표 포함 금액 입력값 → 숫자만
 * @param {string|number} value
 * @returns {string}
 */
export function parseLedgerAmountInput(value) {
  return String(value ?? '').replace(/[^\d]/g, '')
}

/**
 * 금액 입력값 → number
 * @param {string|number} value
 * @returns {number}
 */
export function toLedgerAmountNumber(value) {
  return Number(parseLedgerAmountInput(value)) || 0
}

/**
 * 기본 지출 카테고리
 * fixedCostYn: 기본 고정비 여부 (거래 입력 시 초기값으로 사용)
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '식비', fixedCostYn: false },
  { name: '카페', fixedCostYn: false },
  { name: '교통', fixedCostYn: false },
  { name: '쇼핑', fixedCostYn: false },
  { name: '생활용품', fixedCostYn: false },
  { name: '주거', fixedCostYn: true },
  { name: '통신', fixedCostYn: true },
  { name: '의료', fixedCostYn: false },
  { name: '문화/취미', fixedCostYn: false },
  { name: '여행', fixedCostYn: false },
  { name: '경조사', fixedCostYn: false },
  { name: '구독서비스', fixedCostYn: true },
  { name: '보험', fixedCostYn: true },
  { name: '기타', fixedCostYn: false },
]

/** 기본 수입 카테고리 */
export const DEFAULT_INCOME_CATEGORIES = [
  { name: '급여', fixedCostYn: false },
  { name: '상여', fixedCostYn: false },
  { name: '사업소득', fixedCostYn: false },
  { name: '부수입', fixedCostYn: false },
  { name: '이자', fixedCostYn: false },
  { name: '배당', fixedCostYn: false },
  { name: '투자수익', fixedCostYn: false },
  { name: '기타', fixedCostYn: false },
]

/**
 * @param {string} type
 * @returns {string}
 */
export function getLedgerTransactionTypeLabel(type) {
  const option = LEDGER_TRANSACTION_FILTER_OPTIONS.find((item) => item.id === type)
  return option?.label ?? type
}

/**
 * @param {string} type
 * @returns {string}
 */
export function getLedgerAccountTypeLabel(type) {
  const option = LEDGER_ACCOUNT_TYPE_OPTIONS.find((item) => item.id === type)
  return option?.label ?? type
}

/**
 * @param {string} type
 * @returns {string}
 */
export function getLedgerInvestmentAssetTypeLabel(type) {
  const option = LEDGER_INVESTMENT_ASSET_TYPE_OPTIONS.find((item) => item.id === type)
  return option?.label ?? type
}

/**
 * 금액 표시 (원)
 * @param {number} amount
 * @returns {string}
 */
export function formatLedgerAmount(amount) {
  const value = Number(amount) || 0
  return `${value.toLocaleString('ko-KR')}원`
}

/**
 * 부호 포함 금액 표시
 * @param {number} amount
 * @param {{ showPlus?: boolean }} options
 * @returns {string}
 */
export function formatLedgerSignedAmount(amount, options = {}) {
  const value = Number(amount) || 0
  const abs = Math.abs(value).toLocaleString('ko-KR')
  if (value > 0) return options.showPlus === false ? `${abs}원` : `+${abs}원`
  if (value < 0) return `-${abs}원`
  return `0원`
}

/**
 * 수익/등락 색상 (한국식: +빨강, -파랑)
 * @param {number} value
 * @returns {string}
 */
export function getLedgerProfitColorClass(value) {
  const num = Number(value) || 0
  if (num > 0) return 'text-red-600'
  if (num < 0) return 'text-blue-600'
  return 'text-gray-500'
}
