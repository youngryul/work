/**
 * 가계부 분석 순수 함수
 * TRANSFER / INVESTMENT 는 일반 소비(EXPENSE)에서 제외
 */
import { LEDGER_TRANSACTION_TYPES } from '../constants/ledger.js'
import { isDateInRange } from './ledgerPeriod.js'

/**
 * @param {Array<{ type: string, amount: number, transactionDate: string }>} transactions
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Array}
 */
export function filterByDateRange(transactions, startDate, endDate) {
  return transactions.filter((tx) =>
    isDateInRange(tx.transactionDate, startDate, endDate),
  )
}

/**
 * 실제 소비성 지출 합계 (EXPENSE만)
 * @param {Array<{ type: string, amount: number }>} transactions
 * @returns {number}
 */
export function sumExpenses(transactions) {
  return transactions
    .filter((tx) => tx.type === LEDGER_TRANSACTION_TYPES.EXPENSE)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
}

/**
 * @param {Array<{ type: string, amount: number }>} transactions
 * @returns {number}
 */
export function sumIncome(transactions) {
  return transactions
    .filter((tx) => tx.type === LEDGER_TRANSACTION_TYPES.INCOME)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
}

/**
 * 저축/투자: INVESTMENT + 투자계좌로의 TRANSFER
 * @param {Array<{ type: string, amount: number, toAccountType?: string }>} transactions
 * @returns {number}
 */
export function sumSavingsAndInvestment(transactions) {
  return transactions.reduce((sum, tx) => {
    if (tx.type === LEDGER_TRANSACTION_TYPES.INVESTMENT) {
      return sum + Number(tx.amount || 0)
    }
    if (
      tx.type === LEDGER_TRANSACTION_TYPES.TRANSFER &&
      tx.toAccountType === 'INVESTMENT'
    ) {
      return sum + Number(tx.amount || 0)
    }
    return sum
  }, 0)
}

/**
 * 고정비 / 변동비 합계 (EXPENSE만)
 * @param {Array<{ type: string, amount: number, fixedCostYn?: boolean }>} transactions
 * @returns {{ fixed: number, variable: number, total: number }}
 */
export function sumFixedVariable(transactions) {
  const expenses = transactions.filter(
    (tx) => tx.type === LEDGER_TRANSACTION_TYPES.EXPENSE,
  )
  let fixed = 0
  let variable = 0
  expenses.forEach((tx) => {
    const amount = Number(tx.amount || 0)
    if (tx.fixedCostYn) fixed += amount
    else variable += amount
  })
  return { fixed, variable, total: fixed + variable }
}

/**
 * @param {number} currentAmount
 * @param {number} previousAmount
 * @returns {{ currentAmount: number, previousAmount: number, difference: number, changeRate: number|null }}
 */
export function compareTotals(currentAmount, previousAmount) {
  const current = Number(currentAmount) || 0
  const previous = Number(previousAmount) || 0
  const difference = current - previous
  const changeRate =
    previous === 0 ? (current === 0 ? 0 : null) : (difference / previous) * 100
  return {
    currentAmount: current,
    previousAmount: previous,
    difference,
    changeRate:
      changeRate === null ? null : Math.round(changeRate * 100) / 100,
  }
}

/**
 * 카테고리별 지출 비교
 * @param {Array<{ type: string, amount: number, categoryId?: string, categoryName?: string }>} currentTxs
 * @param {Array<{ type: string, amount: number, categoryId?: string, categoryName?: string }>} previousTxs
 * @returns {Array<{
 *   categoryId: string|null,
 *   category: string,
 *   currentAmount: number,
 *   previousAmount: number,
 *   difference: number,
 *   changeRate: number|null
 * }>}
 */
export function compareByCategory(currentTxs, previousTxs) {
  /** @type {Map<string, { categoryId: string|null, category: string, currentAmount: number, previousAmount: number }>} */
  const map = new Map()

  const add = (tx, field) => {
    if (tx.type !== LEDGER_TRANSACTION_TYPES.EXPENSE) return
    const key = tx.categoryId || tx.categoryName || '기타'
    const name = tx.categoryName || '기타'
    if (!map.has(key)) {
      map.set(key, {
        categoryId: tx.categoryId || null,
        category: name,
        currentAmount: 0,
        previousAmount: 0,
      })
    }
    const row = map.get(key)
    row[field] += Number(tx.amount || 0)
  }

  currentTxs.forEach((tx) => add(tx, 'currentAmount'))
  previousTxs.forEach((tx) => add(tx, 'previousAmount'))

  return [...map.values()]
    .map((row) => {
      const comparison = compareTotals(row.currentAmount, row.previousAmount)
      return {
        categoryId: row.categoryId,
        category: row.category,
        currentAmount: comparison.currentAmount,
        previousAmount: comparison.previousAmount,
        difference: comparison.difference,
        changeRate: comparison.changeRate,
      }
    })
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}

/**
 * 카테고리 비교에서 주요 증감 추출
 * @param {ReturnType<typeof compareByCategory>} categoryComparisons
 */
export function getCategoryHighlights(categoryComparisons) {
  const withChange = categoryComparisons.filter(
    (c) => c.currentAmount > 0 || c.previousAmount > 0,
  )

  const mostIncreased = [...withChange]
    .filter((c) => c.difference > 0)
    .sort((a, b) => b.difference - a.difference)[0] || null

  const mostDecreased = [...withChange]
    .filter((c) => c.difference < 0)
    .sort((a, b) => a.difference - b.difference)[0] || null

  const highestIncreaseRate = [...withChange]
    .filter((c) => c.changeRate !== null && c.changeRate > 0 && c.previousAmount > 0)
    .sort((a, b) => (b.changeRate || 0) - (a.changeRate || 0))[0] || null

  const highestDecreaseRate = [...withChange]
    .filter((c) => c.changeRate !== null && c.changeRate < 0 && c.previousAmount > 0)
    .sort((a, b) => (a.changeRate || 0) - (b.changeRate || 0))[0] || null

  return {
    mostIncreased,
    mostDecreased,
    highestIncreaseRate,
    highestDecreaseRate,
  }
}

/**
 * 규칙 기반 소비 변화 요약 문장
 * @param {{
 *   periodUnit: 'day'|'week'|'month',
 *   totalComparison: ReturnType<typeof compareTotals>,
 *   categoryComparisons: ReturnType<typeof compareByCategory>
 * }} params
 * @returns {{ headline: string, details: string[] }}
 */
export function buildSpendingSummary({
  periodUnit,
  totalComparison,
  categoryComparisons,
}) {
  const periodPhrase =
    periodUnit === 'day'
      ? { now: '오늘은', then: '어제보다' }
      : periodUnit === 'week'
        ? { now: '이번 주는', then: '지난주보다' }
        : { now: '이번 달은', then: '지난달보다' }

  const { difference, currentAmount, previousAmount } = totalComparison
  const highlights = getCategoryHighlights(categoryComparisons)
  const absDiff = Math.abs(difference).toLocaleString('ko-KR')

  let headline
  if (previousAmount === 0 && currentAmount === 0) {
    headline = `${periodPhrase.now} 아직 지출 기록이 없어요.`
  } else if (previousAmount === 0 && currentAmount > 0) {
    headline = `${periodPhrase.now} ${currentAmount.toLocaleString('ko-KR')}원을 사용했어요.`
  } else if (difference === 0) {
    headline = `${periodPhrase.now} ${periodPhrase.then} 지출이 같아요.`
  } else if (difference < 0) {
    headline = `${periodPhrase.now} ${periodPhrase.then} ${absDiff}원 적게 사용했습니다.`
  } else {
    headline = `${periodPhrase.now} ${periodPhrase.then} ${absDiff}원 더 사용했습니다.`
  }

  /** @type {string[]} */
  const details = []

  if (highlights.mostDecreased) {
    details.push(
      `가장 많이 줄어든 카테고리: ${highlights.mostDecreased.category} ${highlights.mostDecreased.difference.toLocaleString('ko-KR')}원`,
    )
  }
  if (highlights.mostIncreased) {
    details.push(
      `가장 많이 증가한 카테고리: ${highlights.mostIncreased.category} +${highlights.mostIncreased.difference.toLocaleString('ko-KR')}원`,
    )
  }
  if (highlights.highestIncreaseRate && highlights.highestIncreaseRate.changeRate !== null) {
    details.push(
      `증가율이 가장 높은 카테고리: ${highlights.highestIncreaseRate.category} (+${highlights.highestIncreaseRate.changeRate.toFixed(1)}%)`,
    )
  }
  if (highlights.highestDecreaseRate && highlights.highestDecreaseRate.changeRate !== null) {
    details.push(
      `감소율이 가장 높은 카테고리: ${highlights.highestDecreaseRate.category} (${highlights.highestDecreaseRate.changeRate.toFixed(1)}%)`,
    )
  }

  return { headline, details, highlights }
}

/**
 * 홈 대시보드용 월간 요약
 * @param {Array} currentMonthTxs
 * @param {Array} previousMonthTxs
 */
export function buildHomeDashboard(currentMonthTxs, previousMonthTxs) {
  const expenseCurrent = sumExpenses(currentMonthTxs)
  const expensePrevious = sumExpenses(previousMonthTxs)
  const income = sumIncome(currentMonthTxs)
  const savings = sumSavingsAndInvestment(currentMonthTxs)
  const remaining = income - expenseCurrent
  const expenseComparison = compareTotals(expenseCurrent, expensePrevious)
  const categoryComparisons = compareByCategory(currentMonthTxs, previousMonthTxs)

  return {
    expense: expenseComparison,
    income,
    savings,
    remaining,
    categoryComparisons,
    summary: buildSpendingSummary({
      periodUnit: 'month',
      totalComparison: expenseComparison,
      categoryComparisons,
    }),
  }
}
