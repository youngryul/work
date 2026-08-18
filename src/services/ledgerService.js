/**
 * 가계부 Supabase 서비스
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_CATEGORY_TYPES,
  LEDGER_CURRENCIES,
  LEDGER_CURRENCY_OPTIONS,
  LEDGER_FALLBACK_KRW_RATES,
  LEDGER_TRANSACTION_TYPES,
} from '../constants/ledger.js'
import {
  fetchExchangeRates,
  mapExchangeQuotesByCode,
} from './exchangeRateService.js'

/**
 * JWT 세션 기준 사용자 ID (FK auth.users 와 일치하도록)
 * @returns {Promise<string>}
 */
async function requireLedgerUserId() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const sessionUserId = data?.session?.user?.id || null
  if (sessionUserId) return sessionUserId

  const fallbackId = await getCurrentUserId()
  if (fallbackId) return fallbackId

  throw new Error('로그인이 필요합니다.')
}

/**
 * 레거시 category 텍스트 컬럼용 라벨
 * @param {string} type
 * @param {string|null|undefined} categoryName
 * @returns {string}
 */
function resolveLegacyCategoryLabel(type, categoryName) {
  if (categoryName) return categoryName
  if (type === LEDGER_TRANSACTION_TYPES.TRANSFER) return '이체'
  if (type === LEDGER_TRANSACTION_TYPES.INVESTMENT) return '투자'
  return '-'
}

/**
 * @param {string} userId
 * @param {string|null|undefined} categoryId
 * @returns {Promise<string|null>}
 */
async function fetchCategoryName(userId, categoryId) {
  if (!categoryId) return null
  const { data, error } = await supabase
    .from('ledger_categories')
    .select('name')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.name || null
}

/**
 * PostgREST "column does not exist" 오류에서 컬럼명 추출
 * @param {unknown} error
 * @returns {string|null}
 */
function extractMissingColumnName(error) {
  const message = String(error?.message || error?.details || '')
  if (!/could not find|schema cache|does not exist/i.test(message)) {
    return null
  }
  const match =
    message.match(/Could not find the ['"]([^'"]+)['"] column/i) ||
    message.match(/column ["']([^"']+)["'] (?:of relation|does not exist)/i)
  return match?.[1] || null
}

/**
 * 없는 레거시 컬럼은 제거하며 insert/update 재시도
 * @param {'insert'|'update'} mode
 * @param {Record<string, unknown>} row
 * @param {{ id?: string, userId?: string }} [context]
 * @returns {Promise<{ data: Object, error: null }|{ data: null, error: Object }>}
 */
async function saveTransactionRow(mode, row, context = {}) {
  /** @type {Record<string, unknown>} */
  let nextRow = { ...row }
  let lastError = null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    let result
    if (mode === 'insert') {
      result = await supabase
        .from('ledger_transactions')
        .insert(nextRow)
        .select('*, ledger_categories ( id, name, type, fixed_cost_yn )')
        .single()
    } else {
      result = await supabase
        .from('ledger_transactions')
        .update(nextRow)
        .eq('id', context.id)
        .eq('user_id', context.userId)
        .select('*, ledger_categories ( id, name, type, fixed_cost_yn )')
        .single()
    }

    if (!result.error) {
      return { data: result.data, error: null }
    }

    lastError = result.error
    const missingColumn = extractMissingColumnName(result.error)
    // 스키마에 없는 컬럼만 제거하고 재시도 (NOT NULL 위반은 그대로 throw)
    if (
      missingColumn &&
      Object.prototype.hasOwnProperty.call(nextRow, missingColumn)
    ) {
      const { [missingColumn]: _removed, ...rest } = nextRow
      nextRow = rest
      continue
    }
    break
  }

  return { data: null, error: lastError }
}

/**
 * @param {Object} row
 * @returns {Object}
 */
function normalizeCategory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    parentCategoryId: row.parent_category_id || null,
    fixedCostYn: Boolean(row.fixed_cost_yn),
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object} row
 * @returns {Object}
 */
function normalizeAccount(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    currency: row.currency || LEDGER_CURRENCIES.KRW,
    balance: Number(row.balance) || 0,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 통화별 1단위당 원화 환율 맵
 * @returns {Promise<Record<string, number>>}
 */
async function getKrwRateMap() {
  /** @type {Record<string, number>} */
  const rates = { ...LEDGER_FALLBACK_KRW_RATES, KRW: 1 }

  try {
    const quotes = await fetchExchangeRates()
    const byCode = mapExchangeQuotesByCode(quotes)
    LEDGER_CURRENCY_OPTIONS.forEach((option) => {
      if (!option.exchangeCode) return
      const quote = byCode[option.exchangeCode]
      if (!quote?.price) return
      rates[option.id] = Number(quote.price) / (option.quoteUnit || 1)
    })
  } catch (error) {
    console.warn('네이버 환율 조회 실패:', error)
  }

  // 네이버에 없거나 실패한 통화(동 등)는 currency-to-krw API로 보완
  const missing = LEDGER_CURRENCY_OPTIONS.filter(
    (option) =>
      option.id !== LEDGER_CURRENCIES.KRW &&
      (rates[option.id] == null ||
        rates[option.id] === LEDGER_FALLBACK_KRW_RATES[option.id]),
  )

  await Promise.all(
    missing.map(async (option) => {
      try {
        const response = await fetch(
          `/api/currency-to-krw?from=${encodeURIComponent(option.id)}`,
        )
        if (!response.ok) return
        const data = await response.json()
        if (typeof data?.rate === 'number' && data.rate > 0) {
          rates[option.id] = data.rate
        }
      } catch (error) {
        console.warn(`${option.id} 환율 보완 실패:`, error)
      }
    }),
  )

  return rates
}

/**
 * @param {number} amount
 * @param {string} currency
 * @param {Record<string, number>} rateMap
 * @returns {number}
 */
function toKrwAmount(amount, currency, rateMap) {
  const value = Number(amount) || 0
  if (!currency || currency === LEDGER_CURRENCIES.KRW) return value
  const rate = rateMap[currency] ?? LEDGER_FALLBACK_KRW_RATES[currency] ?? 0
  return Math.round(value * rate)
}

/**
 * @param {Object} row
 * @param {Map<string, Object>} [accountMap]
 * @returns {Object}
 */
function normalizeTransaction(row, accountMap) {
  const category = row.ledger_categories || row.category || null
  const accountId = row.account_id || null
  const toAccountId = row.to_account_id || null
  const account = accountMap?.get(accountId) || null
  const toAccount = accountMap?.get(toAccountId) || null

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: Number(row.amount) || 0,
    categoryId: row.category_id || null,
    categoryName: category?.name || row.category || null,
    accountId,
    toAccountId,
    accountName: account?.name || null,
    toAccountName: toAccount?.name || null,
    toAccountType: toAccount?.type || null,
    paymentMethod: row.payment_method || '',
    transactionDate: row.transaction_date || row.date || '',
    memo: row.memo || '',
    fixedCostYn: Boolean(row.fixed_cost_yn),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object} row
 * @returns {Object}
 */
function normalizeInvestment(row) {
  const investedAmount = Number(row.invested_amount) || 0
  const currentValue = Number(row.current_value) || 0
  const profit = currentValue - investedAmount
  const profitRate =
    investedAmount === 0 ? null : (profit / investedAmount) * 100
  const currency =
    row.currency ||
    (row.asset_type === 'OVERSEAS_STOCK'
      ? LEDGER_CURRENCIES.USD
      : LEDGER_CURRENCIES.KRW)

  return {
    id: row.id,
    userId: row.user_id,
    assetName: row.asset_name,
    assetType: row.asset_type,
    currency,
    sourceSymbol: row.source_symbol || null,
    quantity: Number(row.quantity) || 0,
    avgPrice: Number(row.avg_price) || 0,
    currentPrice: Number(row.current_price) || 0,
    investedAmount,
    currentValue,
    profit,
    profitRate: profitRate === null ? null : Math.round(profitRate * 100) / 100,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 동일 사용자·유형·이름 카테고리 중복 제거 (가장 오래된 것만 유지)
 * @param {string} userId
 */
async function dedupeCategories(userId) {
  const { data, error } = await supabase
    .from('ledger_categories')
    .select('id, name, type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return

  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {string[]} */
  const duplicateIds = []

  data.forEach((row) => {
    const key = `${row.type}::${row.name}`
    if (seen.has(key)) {
      duplicateIds.push(row.id)
    } else {
      seen.add(key)
    }
  })

  if (duplicateIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('ledger_categories')
    .delete()
    .eq('user_id', userId)
    .in('id', duplicateIds)

  if (deleteError) throw deleteError
}

/**
 * 기본 카테고리 시드 (이미 있으면 건너뜀, 누락분만 추가)
 * @returns {Promise<Object[]>}
 */
export async function ensureDefaultCategories() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  // 중복 시드 정리 후 진행
  await dedupeCategories(userId)

  const { data: existing, error: listError } = await supabase
    .from('ledger_categories')
    .select('id, name, type')
    .eq('user_id', userId)

  if (listError) throw listError

  const existingKeys = new Set(
    (existing || []).map((row) => `${row.type}::${row.name}`),
  )

  const expenseRows = DEFAULT_EXPENSE_CATEGORIES
    .map((item, index) => ({
      user_id: userId,
      name: item.name,
      type: LEDGER_CATEGORY_TYPES.EXPENSE,
      fixed_cost_yn: item.fixedCostYn,
      display_order: index,
    }))
    .filter((row) => !existingKeys.has(`${row.type}::${row.name}`))

  const incomeRows = DEFAULT_INCOME_CATEGORIES
    .map((item, index) => ({
      user_id: userId,
      name: item.name,
      type: LEDGER_CATEGORY_TYPES.INCOME,
      fixed_cost_yn: false,
      display_order: index,
    }))
    .filter((row) => !existingKeys.has(`${row.type}::${row.name}`))

  const toInsert = [...expenseRows, ...incomeRows]
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('ledger_categories')
      .insert(toInsert)

    // 동시 시드로 유니크 충돌이 나도 무시하고 조회
    if (insertError && insertError.code !== '23505') {
      throw insertError
    }
    if (insertError?.code === '23505') {
      await dedupeCategories(userId)
    }
  }

  return getCategories()
}

/**
 * @param {{ type?: string }} [options]
 * @returns {Promise<Object[]>}
 */
export async function getCategories(options = {}) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  let query = supabase
    .from('ledger_categories')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (options.type) {
    query = query.eq('type', options.type)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(normalizeCategory)
}

/**
 * @param {{ name: string, type: string, fixedCostYn?: boolean, displayOrder?: number }} payload
 * @returns {Promise<Object>}
 */
export async function createCategory(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('ledger_categories')
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      fixed_cost_yn: Boolean(payload.fixedCostYn),
      display_order: payload.displayOrder ?? 0,
      parent_category_id: payload.parentCategoryId || null,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeCategory(data)
}

/**
 * @returns {Promise<Object[]>}
 */
export async function getAccounts() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('ledger_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeAccount)
}

/**
 * @param {{ name: string, type: string, currency?: string, balance?: number, displayOrder?: number }} payload
 * @returns {Promise<Object>}
 */
export async function createAccount(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('ledger_accounts')
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      currency: payload.currency || LEDGER_CURRENCIES.KRW,
      balance: Number(payload.balance) || 0,
      display_order: payload.displayOrder ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeAccount(data)
}

/**
 * @param {string} accountId
 * @param {{ name?: string, type?: string, currency?: string, balance?: number, displayOrder?: number }} updates
 * @returns {Promise<Object>}
 */
export async function updateAccount(accountId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  /** @type {Record<string, unknown>} */
  const row = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) row.name = updates.name
  if (updates.type !== undefined) row.type = updates.type
  if (updates.currency !== undefined) {
    row.currency = updates.currency || LEDGER_CURRENCIES.KRW
  }
  if (updates.balance !== undefined) row.balance = Number(updates.balance) || 0
  if (updates.displayOrder !== undefined) row.display_order = updates.displayOrder

  const { data, error } = await supabase
    .from('ledger_accounts')
    .update(row)
    .eq('id', accountId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return normalizeAccount(data)
}

/**
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export async function deleteAccount(accountId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('ledger_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * 계좌 잔액 증감
 * @param {string} accountId
 * @param {number} delta
 */
async function adjustAccountBalance(accountId, delta) {
  if (!accountId || !delta) return

  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('ledger_accounts')
    .select('balance')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  const next = (Number(data.balance) || 0) + delta
  const { error: updateError } = await supabase
    .from('ledger_accounts')
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId)

  if (updateError) throw updateError
}

/**
 * 거래가 계좌 잔액에 미치는 영향 적용/되돌리기
 * @param {Object} tx
 * @param {1|-1} sign 1=적용, -1=되돌리기
 */
async function applyTransactionBalanceEffect(tx, sign) {
  const amount = Number(tx.amount) || 0
  if (!amount) return

  if (tx.type === LEDGER_TRANSACTION_TYPES.EXPENSE && tx.accountId) {
    await adjustAccountBalance(tx.accountId, -amount * sign)
    return
  }
  if (tx.type === LEDGER_TRANSACTION_TYPES.INCOME && tx.accountId) {
    await adjustAccountBalance(tx.accountId, amount * sign)
    return
  }
  if (tx.type === LEDGER_TRANSACTION_TYPES.TRANSFER) {
    if (tx.accountId) await adjustAccountBalance(tx.accountId, -amount * sign)
    if (tx.toAccountId) await adjustAccountBalance(tx.toAccountId, amount * sign)
    return
  }
  if (tx.type === LEDGER_TRANSACTION_TYPES.INVESTMENT && tx.accountId) {
    // 투자 출금: 일반 계좌에서 차감 (투자 계좌로 이동은 TRANSFER로 별도 기록 가능)
    await adjustAccountBalance(tx.accountId, -amount * sign)
  }
}

/**
 * @param {{
 *   startDate?: string,
 *   endDate?: string,
 *   type?: string,
 *   categoryId?: string,
 *   accountId?: string
 * }} [options]
 * @returns {Promise<Object[]>}
 */
export async function getTransactions(options = {}) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  let query = supabase
    .from('ledger_transactions')
    .select('*, ledger_categories ( id, name, type, fixed_cost_yn )')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options.startDate) query = query.gte('transaction_date', options.startDate)
  if (options.endDate) query = query.lte('transaction_date', options.endDate)
  if (options.type) query = query.eq('type', options.type)
  if (options.categoryId) query = query.eq('category_id', options.categoryId)
  if (options.accountId) {
    query = query.or(
      `account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const accounts = await getAccounts()
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  return (data || []).map((row) => normalizeTransaction(row, accountMap))
}

/**
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createTransaction(payload) {
  const userId = await requireLedgerUserId()

  const amount = Number(payload.amount)
  if (!amount || amount <= 0) throw new Error('금액을 입력해주세요.')
  if (!payload.type) throw new Error('거래 유형을 선택해주세요.')
  if (!payload.transactionDate) throw new Error('날짜를 선택해주세요.')

  const needsCategory =
    payload.type === LEDGER_TRANSACTION_TYPES.EXPENSE ||
    payload.type === LEDGER_TRANSACTION_TYPES.INCOME
  if (needsCategory && !payload.categoryId) {
    throw new Error('카테고리를 선택해주세요.')
  }
  if (
    payload.type === LEDGER_TRANSACTION_TYPES.TRANSFER &&
    (!payload.accountId || !payload.toAccountId)
  ) {
    throw new Error('이체 출금/입금 계좌를 선택해주세요.')
  }

  const categoryName = await fetchCategoryName(userId, payload.categoryId)
  const legacyCategory = resolveLegacyCategoryLabel(payload.type, categoryName)

  const row = {
    user_id: userId,
    type: payload.type,
    amount,
    category_id: payload.categoryId || null,
    // 레거시 category 텍스트 컬럼(NOT NULL) 호환
    category: legacyCategory,
    account_id: payload.accountId || null,
    to_account_id: payload.toAccountId || null,
    payment_method: payload.paymentMethod || null,
    // 레거시 date 컬럼(NOT NULL)과 transaction_date 동시 기록
    date: payload.transactionDate,
    transaction_date: payload.transactionDate,
    memo: payload.memo || null,
    fixed_cost_yn: Boolean(payload.fixedCostYn),
  }

  const { data, error } = await saveTransactionRow('insert', row)
  if (error) throw error

  const normalized = normalizeTransaction(data)
  try {
    await applyTransactionBalanceEffect(normalized, 1)
  } catch (balanceError) {
    // 잔액 반영 실패 시 거래는 유지 (수동 조정 가능)
    console.error('계좌 잔액 반영 실패:', balanceError)
  }

  const accounts = await getAccounts()
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  return normalizeTransaction(data, accountMap)
}

/**
 * @param {string} transactionId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateTransaction(transactionId, updates) {
  const userId = await requireLedgerUserId()

  const { data: existing, error: fetchError } = await supabase
    .from('ledger_transactions')
    .select('*, ledger_categories ( id, name, type, fixed_cost_yn )')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw fetchError

  const prev = normalizeTransaction(existing)
  await applyTransactionBalanceEffect(prev, -1)

  /** @type {Record<string, unknown>} */
  const row = { updated_at: new Date().toISOString() }
  if (updates.type !== undefined) row.type = updates.type
  if (updates.amount !== undefined) row.amount = Number(updates.amount)
  if (updates.categoryId !== undefined) {
    row.category_id = updates.categoryId || null
    const categoryName = await fetchCategoryName(userId, updates.categoryId)
    const typeForLabel = updates.type || prev.type
    row.category = resolveLegacyCategoryLabel(typeForLabel, categoryName)
  } else if (updates.type !== undefined) {
    row.category = resolveLegacyCategoryLabel(updates.type, prev.categoryName)
  }
  if (updates.accountId !== undefined) row.account_id = updates.accountId || null
  if (updates.toAccountId !== undefined) row.to_account_id = updates.toAccountId || null
  if (updates.paymentMethod !== undefined) {
    row.payment_method = updates.paymentMethod || null
  }
  if (updates.transactionDate !== undefined) {
    row.transaction_date = updates.transactionDate
    row.date = updates.transactionDate
  }
  if (updates.memo !== undefined) row.memo = updates.memo || null
  if (updates.fixedCostYn !== undefined) row.fixed_cost_yn = Boolean(updates.fixedCostYn)

  const { data, error } = await saveTransactionRow('update', row, {
    id: transactionId,
    userId,
  })
  if (error) throw error

  const next = normalizeTransaction(data)
  try {
    await applyTransactionBalanceEffect(next, 1)
  } catch (balanceError) {
    console.error('계좌 잔액 반영 실패:', balanceError)
  }

  const accounts = await getAccounts()
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  return normalizeTransaction(data, accountMap)
}

/**
 * @param {string} transactionId
 * @returns {Promise<void>}
 */
export async function deleteTransaction(transactionId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data: existing, error: fetchError } = await supabase
    .from('ledger_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw fetchError

  const prev = normalizeTransaction(existing)
  await applyTransactionBalanceEffect(prev, -1)

  const { error } = await supabase
    .from('ledger_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * 자산/부채/순자산 요약 (외화는 원화 환산)
 * @returns {Promise<{
 *   accounts: Object[],
 *   totalAssets: number,
 *   totalLiabilities: number,
 *   netWorth: number,
 *   rates: Record<string, number>
 * }>}
 */
export async function getNetWorthSummary() {
  const [accounts, rateMap] = await Promise.all([
    getAccounts(),
    getKrwRateMap(),
  ])

  let totalAssets = 0
  let totalLiabilities = 0

  const enriched = accounts.map((account) => {
    const balanceKrw = toKrwAmount(account.balance, account.currency, rateMap)
    return {
      ...account,
      balanceKrw,
      krwRate: rateMap[account.currency] ?? 1,
    }
  })

  enriched.forEach((account) => {
    if (account.type === LEDGER_ACCOUNT_TYPES.LOAN) {
      totalLiabilities += Math.abs(account.balanceKrw)
    } else if (
      account.type !== LEDGER_ACCOUNT_TYPES.CARD &&
      account.type !== LEDGER_ACCOUNT_TYPES.INVESTMENT
    ) {
      totalAssets += account.balanceKrw
    }
  })

  return {
    accounts: enriched,
    totalAssets,
    totalLiabilities,
    // 순자산은 부채를 제외한 자산 합계로 표시
    netWorth: totalAssets,
    rates: rateMap,
  }
}

/**
 * @returns {Promise<Object[]>}
 */
export async function getInvestments() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('ledger_investments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeInvestment)
}

/**
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createInvestment(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const investedAmount = Number(payload.investedAmount) || 0
  const currentValue = Number(payload.currentValue) || investedAmount

  const { data, error } = await supabase
    .from('ledger_investments')
    .insert({
      user_id: userId,
      asset_name: payload.assetName,
      asset_type: payload.assetType,
      currency: payload.currency || LEDGER_CURRENCIES.KRW,
      source_symbol: payload.sourceSymbol || null,
      quantity: Number(payload.quantity) || 0,
      avg_price: Number(payload.avgPrice) || 0,
      current_price: Number(payload.currentPrice) || 0,
      invested_amount: investedAmount,
      current_value: currentValue,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeInvestment(data)
}

/**
 * @param {string} investmentId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateInvestment(investmentId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  /** @type {Record<string, unknown>} */
  const row = { updated_at: new Date().toISOString() }
  if (updates.assetName !== undefined) row.asset_name = updates.assetName
  if (updates.assetType !== undefined) row.asset_type = updates.assetType
  if (updates.currency !== undefined) {
    row.currency = updates.currency || LEDGER_CURRENCIES.KRW
  }
  if (updates.sourceSymbol !== undefined) {
    row.source_symbol = updates.sourceSymbol || null
  }
  if (updates.quantity !== undefined) row.quantity = Number(updates.quantity) || 0
  if (updates.avgPrice !== undefined) row.avg_price = Number(updates.avgPrice) || 0
  if (updates.currentPrice !== undefined) {
    row.current_price = Number(updates.currentPrice) || 0
  }
  if (updates.investedAmount !== undefined) {
    row.invested_amount = Number(updates.investedAmount) || 0
  }
  if (updates.currentValue !== undefined) {
    row.current_value = Number(updates.currentValue) || 0
  }

  const { data, error } = await supabase
    .from('ledger_investments')
    .update(row)
    .eq('id', investmentId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return normalizeInvestment(data)
}

/**
 * @param {string} investmentId
 * @returns {Promise<void>}
 */
export async function deleteInvestment(investmentId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('ledger_investments')
    .delete()
    .eq('id', investmentId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * USD→KRW 환율 (1달러당 원)
 * @returns {Promise<number>}
 */
export async function getUsdKrwRate() {
  const rateMap = await getKrwRateMap()
  if (rateMap.USD > 0) return rateMap.USD
  try {
    const response = await fetch('/api/currency-to-krw?from=USD')
    if (!response.ok) return LEDGER_FALLBACK_KRW_RATES.USD
    const data = await response.json()
    return typeof data?.rate === 'number' ? data.rate : LEDGER_FALLBACK_KRW_RATES.USD
  } catch {
    return LEDGER_FALLBACK_KRW_RATES.USD
  }
}

/**
 * 주식 보유 1건 → 가계부 투자 upsert
 * @param {{
 *   symbol: string,
 *   displayName: string,
 *   holdingsQuantity: number,
 *   averagePrice: number,
 *   currentPrice?: number | null
 * }} stock
 * @returns {Promise<Object|null>}
 */
export async function upsertInvestmentFromStock(stock) {
  const { buildLedgerInvestmentFromStock } = await import(
    '../utils/ledgerStockSync.js'
  )

  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data: existing, error: findError } = await supabase
    .from('ledger_investments')
    .select('id, currency, asset_type')
    .eq('user_id', userId)
    .eq('source_symbol', stock.symbol)
    .maybeSingle()

  if (findError) throw findError

  const usdKrwRate = await getUsdKrwRate().catch(
    () => LEDGER_FALLBACK_KRW_RATES.USD,
  )
  const payload = buildLedgerInvestmentFromStock(stock, {
    currency: existing?.currency || undefined,
    usdKrwRate,
  })
  if (!payload) return null

  if (existing?.id) {
    return updateInvestment(existing.id, payload)
  }
  return createInvestment(payload)
}

/**
 * 주식 관심종목 중 보유분만 가계부 투자로 동기화
 * @returns {Promise<{ synced: number, skipped: number }>}
 */
export async function syncInvestmentsFromStockHoldings() {
  const { getMyStockWatchlist } = await import('./stockWatchlistService.js')
  const { fetchStockQuotes } = await import('./stockMarketService.js')
  const { hasStockHoldings } = await import('../utils/stockHoldings.js')

  const watchlist = await getMyStockWatchlist()
  const holdings = watchlist.filter((item) => hasStockHoldings(item))
  if (holdings.length === 0) {
    return { synced: 0, skipped: watchlist.length }
  }

  /** @type {Record<string, { currentPrice?: number }>} */
  let quotes = {}
  try {
    quotes = await fetchStockQuotes(holdings.map((item) => item.symbol))
  } catch (error) {
    console.warn('주식 시세 조회 실패, 평단가로 동기화:', error)
  }

  let synced = 0
  for (const item of holdings) {
    const quote = quotes[item.symbol]
    await upsertInvestmentFromStock({
      symbol: item.symbol,
      displayName: item.displayName,
      holdingsQuantity: item.holdingsQuantity,
      averagePrice: item.averagePrice,
      currentPrice: quote?.currentPrice ?? null,
    })
    synced += 1
  }

  return { synced, skipped: watchlist.length - holdings.length }
}

/**
 * 가계부 초기 데이터 로드 (카테고리 시드 포함)
 * @returns {Promise<{ categories: Object[], accounts: Object[] }>}
 */
export async function bootstrapLedger() {
  const categories = await ensureDefaultCategories()
  const accounts = await getAccounts()
  return { categories, accounts }
}
