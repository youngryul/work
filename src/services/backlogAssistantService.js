import {
  BACKLOG_ASSISTANT_DECOMPOSE_MAX_STEPS,
  BACKLOG_ASSISTANT_MAX_SCHEDULED_OCCURRENCES,
  BACKLOG_ASSISTANT_MAX_TOKENS,
  BACKLOG_ASSISTANT_MODEL,
  BACKLOG_ASSISTANT_SYSTEM_PROMPT,
  DEV_TASK_DECOMPOSE_STEPS,
  GENERAL_TASK_DECOMPOSE_STEPS,
} from '../constants/backlogAssistant.js'
import {
  assertSufficientTokensForBacklogAssistant,
  consumeTokensForBacklogAssistant,
} from './aiTokenService.js'
import { getCategories, getDefaultCategory } from './categoryService.js'
import { getHabitTrackers } from './goalService.js'
import {
  createTask,
  getBacklogTasks,
  getCompletedTasksByDate,
  getCompletedTasksByMonth,
  getTodayTasks,
} from './taskService.js'

/**
 * @typedef {Object} BacklogAssistantSuggestion
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} reason
 * @property {'none'|'daily'|'weekly'|'monthly'} recurrence
 * @property {string[]} scheduledDates
 * @property {string} [memo]
 */

/**
 * @typedef {Object} BacklogAssistantContext
 * @property {string[]} categories
 * @property {string} defaultCategory
 * @property {Array<{ title: string, category: string, scheduledDate: string | null }>} backlog
 * @property {string} todayString
 * @property {string} yesterdayString
 * @property {Array<{ title: string, category: string, completed: boolean, memo: string | null }>} todayTasks
 * @property {Array<{ title: string, category: string, memo: string | null, completedAt: string }>} yesterdayCompleted
 * @property {Array<{ title: string, category: string, memo: string | null, completedAt: string }>} todayCompleted
 * @property {Array<{ title: string, category: string, completedDates: string[] }>} recentCompletedPatterns
 * @property {Array<{ title: string, completedDays: number, daysInMonth: number }>} habits
 */

/**
 * @param {string} date
 * @returns {string}
 */
function formatDateLabel(date) {
  const [year, month, day] = date.split('-').map(Number)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[new Date(year, month - 1, day).getDay()]
  return `${month}/${day}(${weekday})`
}

/**
 * @param {number} completedAt
 * @returns {string}
 */
function toDateStringFromTimestamp(completedAt) {
  const date = new Date(completedAt)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * @param {number} dayOffset - 0=오늘, -1=어제
 * @returns {string}
 */
function getDateStringWithOffset(dayOffset) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  return toDateStringFromTimestamp(date.getTime())
}

/**
 * @param {Array} tasks
 * @returns {Array<{ title: string, category: string, memo: string | null, completedAt: string }>}
 */
function mapCompletedTasksForContext(tasks) {
  return (tasks || []).map((task) => ({
    title: task.title,
    category: task.category,
    memo: task.memo || null,
    completedAt: task.completedAt ? toDateStringFromTimestamp(task.completedAt) : '',
  }))
}

/**
 * @param {Array} tasks
 * @returns {Array<{ title: string, category: string, completedDates: string[] }>}
 */
function summarizeCompletedPatterns(tasks) {
  /** @type {Map<string, { title: string, category: string, completedDates: string[] }>} */
  const map = new Map()

  tasks.forEach((task) => {
    const key = `${task.category}::${task.title.trim().toLowerCase()}`
    const date = task.completedAt ? toDateStringFromTimestamp(task.completedAt) : null
    if (!map.has(key)) {
      map.set(key, {
        title: task.title,
        category: task.category,
        completedDates: date ? [date] : [],
      })
      return
    }
    const entry = map.get(key)
    if (date && !entry.completedDates.includes(date)) {
      entry.completedDates.push(date)
    }
  })

  return [...map.values()]
    .map((entry) => ({
      ...entry,
      completedDates: entry.completedDates.sort(),
    }))
    .sort((a, b) => b.completedDates.length - a.completedDates.length)
    .slice(0, 30)
}

/**
 * 백로그 어시스턴트용 사용자 데이터 수집
 * @returns {Promise<BacklogAssistantContext>}
 */
export async function buildBacklogAssistantContext() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()

  const todayString = getDateStringWithOffset(0)
  const yesterdayString = getDateStringWithOffset(-1)

  const [
    categories,
    defaultCategory,
    backlog,
    todayTasks,
    completedByMonth,
    habits,
    yesterdayCompleted,
    todayCompleted,
  ] = await Promise.all([
    getCategories(),
    getDefaultCategory(),
    getBacklogTasks(),
    getTodayTasks(),
    getCompletedTasksByMonth(year, month),
    getHabitTrackers(year, month),
    getCompletedTasksByDate(yesterdayString),
    getCompletedTasksByDate(todayString),
  ])

  const recentCompleted = Object.values(completedByMonth || {}).flat()

  return {
    categories: categories.map((cat) => cat.name),
    defaultCategory,
    todayString,
    yesterdayString,
    backlog: backlog.map((task) => ({
      title: task.title,
      category: task.category,
      scheduledDate: task.scheduledDate || null,
      memo: task.memo || null,
    })),
    todayTasks: todayTasks.map((task) => ({
      title: task.title,
      category: task.category,
      completed: Boolean(task.completed),
      memo: task.memo || null,
    })),
    yesterdayCompleted: mapCompletedTasksForContext(yesterdayCompleted),
    todayCompleted: mapCompletedTasksForContext(todayCompleted),
    recentCompletedPatterns: summarizeCompletedPatterns(recentCompleted),
    habits: habits.map((tracker) => ({
      title: tracker.title,
      completedDays: (tracker.days || []).filter((day) => day.isCompleted).length,
      daysInMonth,
    })),
  }
}

/**
 * 할일 제목 비교용 정규화
 * @param {string} title
 * @returns {string}
 */
function normalizeTaskTitleForCompare(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•\-_/.,!?()[\]{}'":;~]/g, '')
}

/**
 * 두 할일 제목이 중복인지 판별 (정규화 후 완전 일치만)
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSimilarTaskTitle(a, b) {
  const na = normalizeTaskTitleForCompare(a)
  const nb = normalizeTaskTitleForCompare(b)
  if (!na || !nb) return false
  return na === nb
}

/**
 * 큰 할일(쪼개기 대상) 여부 판별
 * @param {string} title
 * @returns {boolean}
 */
function isLargeTaskTitle(title) {
  const text = String(title || '').trim()
  if (text.length < 8) return false

  const largePatterns = [
    /기능/,
    /만들기/,
    /개발/,
    /구현/,
    /구축/,
    /프로젝트/,
    /시스템/,
    /전면/,
    /개편/,
    /고도화/,
    /리뉴얼/,
    /설계/,
    /기획/,
  ]

  if (largePatterns.some((pattern) => pattern.test(text))) return true
  return text.length >= 18
}

/**
 * 개발·기능 성격의 큰 할일 여부
 * @param {string} title
 * @returns {boolean}
 */
function isDevLikeTaskTitle(title) {
  const text = String(title || '')
  return /기능|개발|구현|앱|화면|DB|API|MVP|시스템|설계|프로토타입/i.test(text)
}

/**
 * @param {BacklogAssistantContext} context
 * @returns {Array<{ title: string, category: string, memo?: string | null }>}
 */
function findLargeTasksInContext(context) {
  const pool = [
    ...context.backlog,
    ...context.todayTasks.filter((task) => !task.completed),
  ]

  const seen = new Set()
  return pool.filter((task) => {
    if (!isLargeTaskTitle(task.title)) return false
    const key = normalizeTaskTitleForCompare(task.title)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * @param {string} userMessage
 * @param {BacklogAssistantContext} context
 * @returns {{ title: string, category: string, memo?: string | null } | null}
 */
function findDecomposeSourceTask(userMessage, context) {
  const pool = [
    ...context.backlog,
    ...context.todayTasks.filter((task) => !task.completed),
    ...context.yesterdayCompleted,
    ...context.todayCompleted,
  ]

  const quoted = userMessage.match(/["'「『](.+?)["'」』]/)
  if (quoted?.[1]) {
    const matched = pool.find((task) => task.title.includes(quoted[1].trim()))
    if (matched) return matched
  }

  const sortedByMatch = pool
    .map((task) => ({
      task,
      score: task.title.length > 3 && userMessage.includes(task.title) ? task.title.length : 0,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (sortedByMatch.length > 0) return sortedByMatch[0].task

  const largeTasks = findLargeTasksInContext(context)
  return largeTasks[0] || null
}

/**
 * 큰 할일 자동 쪼개기 폴백
 * @param {string} userMessage
 * @param {BacklogAssistantContext} context
 * @returns {BacklogAssistantSuggestion[]}
 */
function buildFallbackDecomposeSuggestions(userMessage, context) {
  const decomposeIntent = /쪼개|나눠|분해|단계|실행 가능|작은 할일|하위/.test(userMessage)
  if (!decomposeIntent) return []

  const source = findDecomposeSourceTask(userMessage, context)
  if (!source) return []

  const steps = (
    isDevLikeTaskTitle(source.title) ? DEV_TASK_DECOMPOSE_STEPS : GENERAL_TASK_DECOMPOSE_STEPS
  ).slice(0, BACKLOG_ASSISTANT_DECOMPOSE_MAX_STEPS)

  return steps.map((step, index) => ({
    id: `decompose-${Date.now()}-${index}`,
    title: `${source.title} — ${step}`,
    category: normalizeSuggestionCategory(
      source.category,
      context.categories,
      context.defaultCategory,
    ),
    reason: `큰 할일을 실행 가능한 ${steps.length}단계 중 ${index + 1}번째 작업입니다.`,
    recurrence: 'none',
    scheduledDates: [],
    memo: `원본: ${source.title}`,
  }))
}

/**
 * @param {BacklogAssistantContext} context
 * @param {string} userMessage
 * @returns {Array<{ title: string, category: string, memo?: string | null }>}
 */
function getRecentTasksPool(context, userMessage) {
  const recentOnly = /어제|오늘/.test(userMessage)
  const recentPool = [
    ...context.yesterdayCompleted,
    ...context.todayCompleted,
    ...context.todayTasks,
  ]

  if (recentOnly) return recentPool

  return [
    ...recentPool,
    ...context.backlog,
  ]
}

/**
 * @param {string} userMessage
 * @param {{ excludeWords?: string[] }} [options]
 * @returns {string[]}
 */
function extractSearchKeywordsForSplit(userMessage, options = {}) {
  const excludeWords = options.excludeWords || []
  const relatedMatch = userMessage.match(/([가-힣a-zA-Z0-9\s]{2,}?)\s*관련/)
  if (relatedMatch) {
    const words = relatedMatch[1].match(/[가-힣]{2,}/g) || []
    const filtered = words.filter((word) => !['어제', '오늘'].includes(word))
    if (filtered.length > 0) {
      return [...new Set(filtered)]
    }
  }

  const stopWords = new Set([
    '어제',
    '오늘',
    '확인',
    '해서',
    '관련',
    '작업',
    '업무',
    '생성',
    '하고',
    '싶어',
    '할일',
    '말고',
    '대신',
    '만들',
    '만들어',
    '조회',
    '확인해서',
    ...excludeWords,
  ].filter(Boolean))

  const tokens = userMessage.match(/[가-힣]{2,}/g) || []
  return [...new Set(tokens.filter((token) => !stopWords.has(token) && token.length >= 2))]
}

/**
 * @param {BacklogAssistantContext} context
 * @param {string[]} keywords
 * @param {Array<{ title: string, category: string, memo?: string | null }>} [taskPool]
 * @returns {Array<{ title: string, category: string, memo?: string | null }>}
 */
function findTasksMatchingKeywords(context, keywords, taskPool = null) {
  if (!keywords.length) return []

  const pool =
    taskPool ||
    [
      ...context.yesterdayCompleted,
      ...context.todayCompleted,
      ...context.todayTasks.filter((task) => !task.completed),
      ...context.backlog,
    ]

  const scored = pool
    .map((task) => ({
      task,
      score: keywords.filter((keyword) => task.title.includes(keyword)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const seen = new Set()
  return scored
    .map((item) => item.task)
    .filter((task) => {
      const key = normalizeTaskTitleForCompare(task.title)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * AI가 제안하지 못한 경우, 사용자 생성 요청에서 분리 할일 폴백 생성
 * @param {string} userMessage
 * @param {BacklogAssistantContext} context
 * @returns {BacklogAssistantSuggestion[]}
 */
function buildFallbackSplitSuggestions(userMessage, context) {
  const creationIntent = /만들어|생성|분리|각각|할일로|등록/.test(userMessage)
  if (!creationIntent) return []

  const listMatch =
    userMessage.match(
      /([가-힣a-zA-Z0-9]+(?:\s*[,·/]\s*[가-힣a-zA-Z0-9]+)+)\s*(?:로|으로)?\s*각각/,
    ) ||
    userMessage.match(
      /(?:말고|대신)\s*([가-힣a-zA-Z0-9]+(?:\s*[,·/]\s*[가-힣a-zA-Z0-9]+)+)\s*(?:로|으로)?(?:\s*업무)?/,
    )

  if (!listMatch) return []

  const subtopics = listMatch[1]
    .split(/[,·/]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)

  if (subtopics.length < 2) return []

  const malgoMatch = userMessage.match(/([가-힣a-zA-Z0-9]{2,})\s*(?:말고|대신)/)
  const fromKeyword = malgoMatch?.[1]?.trim()

  const searchKeywords = extractSearchKeywordsForSplit(userMessage, {
    excludeWords: fromKeyword ? [fromKeyword, ...subtopics] : subtopics,
  })
  if (fromKeyword) searchKeywords.push(fromKeyword)

  const pool = getRecentTasksPool(context, userMessage)
  const sourceTasks = findTasksMatchingKeywords(context, [...new Set(searchKeywords)], pool)
  const source = sourceTasks.find((task) => !fromKeyword || task.title.includes(fromKeyword)) || sourceTasks[0]

  const category = source?.category || context.defaultCategory

  return subtopics.map((subtopic, index) => {
    const title = source ? `${source.title} — ${subtopic}` : `${searchKeywords.join(' ')} — ${subtopic}`

    return {
      id: `fallback-${Date.now()}-${index}`,
      title,
      category: normalizeSuggestionCategory(category, context.categories, context.defaultCategory),
      reason: source
        ? `'${source.title}' 업무를 바탕으로 '${subtopic}' 할일을 생성했습니다.`
        : `요청하신 '${subtopic}' 항목으로 할일을 구성했습니다.`,
      recurrence: 'none',
      scheduledDates: [],
      memo: source ? `원본: ${source.title}` : '',
    }
  })
}

/**
 * @param {BacklogAssistantContext} context
 * @returns {string[]}
 */
function collectExistingTaskTitles(context) {
  const titles = new Set()

  context.backlog.forEach((task) => {
    if (task.title?.trim()) titles.add(task.title.trim())
  })

  context.todayTasks.forEach((task) => {
    if (task.title?.trim()) titles.add(task.title.trim())
  })

  return [...titles]
}

/**
 * 기존 할일과 중복되는 제안 제거
 * @param {BacklogAssistantSuggestion[]} suggestions
 * @param {BacklogAssistantContext} context
 * @returns {{ suggestions: BacklogAssistantSuggestion[], removedCount: number }}
 */
function filterDuplicateSuggestions(suggestions, context) {
  const existingTitles = collectExistingTaskTitles(context)
  const seenSuggestionTitles = []

  const filtered = suggestions.filter((suggestion) => {
    const isDuplicateOfExisting = existingTitles.some((existingTitle) =>
      isSimilarTaskTitle(suggestion.title, existingTitle),
    )
    if (isDuplicateOfExisting) return false

    const isDuplicateWithinBatch = seenSuggestionTitles.some((seenTitle) =>
      isSimilarTaskTitle(suggestion.title, seenTitle),
    )
    if (isDuplicateWithinBatch) return false

    seenSuggestionTitles.push(suggestion.title)
    return true
  })

  return {
    suggestions: filtered,
    removedCount: suggestions.length - filtered.length,
  }
}

/**
 * @param {string} reply
 * @param {number} removedCount
 * @param {number} remainingCount
 * @returns {string}
 */
function buildReplyAfterDedup(reply, removedCount, remainingCount) {
  const baseReply = String(reply || '분석을 완료했습니다. 아래 제안을 확인해 주세요.').trim()

  if (removedCount <= 0) return baseReply

  if (remainingCount === 0) {
    return '요청하신 내용으로 새 할일을 만들 수 없었어요. 원본 할일 키워드(예: 총무, 부동산)와 만들 항목(예: 차량, 렌탈)을 함께 적어 주시면 DB에서 찾아 분리해 드릴게요.'
  }

  return `${baseReply}\n\n(이미 등록된 할일 ${removedCount}건은 중복 방지를 위해 제외했어요.)`
}

function formatTaskLine(task, extra = '') {
  const memo = task.memo ? ` | 메모: ${task.memo}` : ''
  return `- [${task.category}] ${task.title}${memo}${extra}`
}

/**
 * @param {BacklogAssistantContext} context
 * @returns {string}
 */
function buildContextPrompt(context) {
  const existingTitles = collectExistingTaskTitles(context)
  const excludeListText =
    existingTitles.length > 0
      ? existingTitles.map((title) => `- ${title}`).join('\n')
      : '(없음)'

  const backlogText =
    context.backlog.length > 0
      ? context.backlog
          .map((task) => {
            const schedule = task.scheduledDate ? ` (예약: ${task.scheduledDate})` : ''
            return formatTaskLine(task, schedule)
          })
          .join('\n')
      : '(비어 있음)'

  const todayText =
    context.todayTasks.length > 0
      ? context.todayTasks
          .map((task) => formatTaskLine(task, task.completed ? ' (완료)' : ' (미완료)'))
          .join('\n')
      : '(비어 있음)'

  const yesterdayCompletedText =
    context.yesterdayCompleted.length > 0
      ? context.yesterdayCompleted.map((task) => formatTaskLine(task)).join('\n')
      : '(없음)'

  const todayCompletedText =
    context.todayCompleted.length > 0
      ? context.todayCompleted.map((task) => formatTaskLine(task)).join('\n')
      : '(없음)'

  const largeTaskCandidates = findLargeTasksInContext(context)
  const largeTasksText =
    largeTaskCandidates.length > 0
      ? largeTaskCandidates.map((task) => formatTaskLine(task)).join('\n')
      : '(없음 — 쪼개기가 필요한 큰 할일 없음)'

  const completedText =
    context.recentCompletedPatterns.length > 0
      ? context.recentCompletedPatterns
          .map((item) => {
            const dates = item.completedDates.slice(-5).join(', ')
            return `- [${item.category}] ${item.title} — 완료 ${item.completedDates.length}회 (최근: ${dates})`
          })
          .join('\n')
      : '(이번 달 완료 기록 없음)'

  const habitsText =
    context.habits.length > 0
      ? context.habits
          .map(
            (habit) =>
              `- ${habit.title}: ${habit.completedDays}/${habit.daysInMonth}일 달성`,
          )
          .join('\n')
      : '(등록된 습관 없음)'

  return `오늘 날짜: ${context.todayString}
어제 날짜: ${context.yesterdayString}
사용 가능 카테고리: ${context.categories.join(', ')}
기본 카테고리: ${context.defaultCategory}

[추천 금지 목록 — 아래와 완전히 동일한 제목만 suggestions에 넣지 마세요]
${excludeListText}

[어제 완료한 할일] (${context.yesterdayString})
${yesterdayCompletedText}

[오늘 완료한 할일] (${context.todayString})
${todayCompletedText}

[현재 백로그]
${backlogText}

[오늘 할일]
${todayText}

[큰 할일 후보 — 자동 쪼개기 대상]
${largeTasksText}

[이번 달 완료 패턴]
${completedText}

[이번 달 습관 트래커]
${habitsText}`
}

/**
 * @param {string} category
 * @param {string[]} allowedCategories
 * @param {string} fallback
 * @returns {string}
 */
function normalizeSuggestionCategory(category, allowedCategories, fallback) {
  const trimmed = (category || '').trim()
  if (allowedCategories.includes(trimmed)) return trimmed

  const fuzzy = allowedCategories.find(
    (name) =>
      name.includes(trimmed) ||
      trimmed.includes(name) ||
      name.toLowerCase() === trimmed.toLowerCase(),
  )
  return fuzzy || fallback
}

/**
 * @param {unknown} raw
 * @param {string[]} allowedCategories
 * @param {string} fallbackCategory
 * @returns {BacklogAssistantSuggestion[]}
 */
function parseAssistantSuggestions(raw, allowedCategories, fallbackCategory) {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      const title = String(item?.title || '').trim()
      if (!title) return null

      const recurrence = ['none', 'daily', 'weekly', 'monthly'].includes(item?.recurrence)
        ? item.recurrence
        : 'none'

      const scheduledDates = Array.isArray(item?.scheduledDates)
        ? item.scheduledDates
            .map((date) => String(date).trim())
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
            .slice(0, BACKLOG_ASSISTANT_MAX_SCHEDULED_OCCURRENCES)
        : []

      return {
        id: `suggestion-${Date.now()}-${index}`,
        title,
        category: normalizeSuggestionCategory(item?.category, allowedCategories, fallbackCategory),
        reason: String(item?.reason || '').trim(),
        recurrence,
        scheduledDates,
        memo: item?.memo ? String(item.memo).trim() : '',
      }
    })
    .filter(Boolean)
}

/**
 * @param {string} content
 * @returns {Object}
 */
function parseAssistantJson(content) {
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 응답을 해석하지 못했습니다.')
    return JSON.parse(match[0])
  }
}

/**
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @param {BacklogAssistantContext} context
 * @returns {Promise<{ reply: string, suggestions: BacklogAssistantSuggestion[], remainingBalance: number }>}
 */
export async function sendBacklogAssistantMessage(messages, context) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. (VITE_OPENAI_API_KEY)')
  }

  await assertSufficientTokensForBacklogAssistant()

  const contextPrompt = buildContextPrompt(context)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: BACKLOG_ASSISTANT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BACKLOG_ASSISTANT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `다음은 사용자 데이터입니다.\n\n${contextPrompt}`,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_tokens: BACKLOG_ASSISTANT_MAX_TOKENS,
      temperature: 0.6,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || 'AI 응답 생성에 실패했습니다.')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 응답이 비어 있습니다.')

  const parsed = parseAssistantJson(content)
  const lastUserMessage = messages[messages.length - 1]?.content || ''

  let rawSuggestions = parseAssistantSuggestions(
    parsed.suggestions,
    context.categories,
    context.defaultCategory,
  )

  if (rawSuggestions.length === 0) {
    rawSuggestions = buildFallbackDecomposeSuggestions(lastUserMessage, context)
  }

  if (rawSuggestions.length === 0) {
    rawSuggestions = buildFallbackSplitSuggestions(lastUserMessage, context)
  }

  const { suggestions, removedCount } = filterDuplicateSuggestions(rawSuggestions, context)
  let reply = buildReplyAfterDedup(parsed.reply, removedCount, suggestions.length)

  const usedDecomposeFallback = rawSuggestions.some((item) =>
    String(item.id).startsWith('decompose-'),
  )
  const usedSplitFallback = rawSuggestions.some((item) => String(item.id).startsWith('fallback-'))

  if (suggestions.length > 0 && usedDecomposeFallback) {
    reply = `큰 할일을 실행 가능한 단계로 쪼갰어요. 순서대로 확인한 뒤 확정 등록해 주세요.\n\n${reply}`
  } else if (suggestions.length > 0 && usedSplitFallback) {
    reply = `DB에서 관련 할일을 찾아 요청하신 항목으로 분리했어요. 아래 내용을 확인한 뒤 확정 등록해 주세요.\n\n${reply}`
  }

  const remainingBalance = await consumeTokensForBacklogAssistant()

  return {
    reply,
    suggestions,
    remainingBalance,
  }
}

/**
 * @param {BacklogAssistantSuggestion} suggestion
 * @returns {Array<{ title: string, category: string, scheduledDate: string | null, memo: string }>}
 */
function expandSuggestionToTasks(suggestion) {
  const baseMemo = suggestion.memo || ''
  const recurrenceMemo =
    suggestion.recurrence !== 'none'
      ? `반복: ${suggestion.recurrence}${baseMemo ? ` · ${baseMemo}` : ''}`
      : baseMemo

  if (suggestion.scheduledDates.length > 0) {
    return suggestion.scheduledDates.map((scheduledDate) => ({
      title: suggestion.title,
      category: suggestion.category,
      scheduledDate,
      memo: recurrenceMemo,
    }))
  }

  return [
    {
      title: suggestion.title,
      category: suggestion.category,
      scheduledDate: null,
      memo: recurrenceMemo,
    },
  ]
}

/**
 * 선택한 제안을 백로그에 등록
 * @param {BacklogAssistantSuggestion[]} suggestions
 * @returns {Promise<number>} 생성된 할일 개수
 */
export async function confirmBacklogSuggestions(suggestions) {
  if (!suggestions.length) return 0

  const context = await buildBacklogAssistantContext()
  const { suggestions: safeSuggestions } = filterDuplicateSuggestions(suggestions, context)

  if (!safeSuggestions.length) {
    throw new Error('선택한 할일이 이미 백로그·오늘 할일에 있어 등록할 수 없습니다.')
  }

  let createdCount = 0

  for (const suggestion of safeSuggestions) {
    const tasksToCreate = expandSuggestionToTasks(suggestion)
    for (const taskData of tasksToCreate) {
      await createTask(taskData.title, taskData.category, false, {
        scheduledDate: taskData.scheduledDate,
        memo: taskData.memo || null,
      })
      createdCount += 1
    }
  }

  return createdCount
}

/**
 * @param {BacklogAssistantSuggestion} suggestion
 * @returns {string}
 */
export function formatSuggestionScheduleLabel(suggestion) {
  if (!suggestion.scheduledDates.length) return '일정 없음 (백로그 즉시 등록)'
  return suggestion.scheduledDates.map(formatDateLabel).join(', ')
}
