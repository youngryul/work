import { pgTable, uuid, text, boolean, bigint, timestamp, numeric, primaryKey, integer } from 'drizzle-orm/pg-core'

/**
 * categories 테이블 스키마 정의
 */
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  emoji: text('emoji').notNull(),
})

/**
 * tasks 테이블 스키마 정의
 * 
 * PostgreSQL은 따옴표로 감싸지 않은 컬럼명을 소문자로 변환하므로,
 * Supabase와의 호환성을 위해 소문자 컬럼명을 사용합니다.
 */
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  completed: boolean('completed').default(false).notNull(),
  isToday: boolean('istoday').default(false).notNull(),
  category: text('category').default('작업').notNull(),
  createdAt: bigint('createdat', { mode: 'number' }).notNull(),
  completedAt: bigint('completedat', { mode: 'number' }),
  movedToTodayAt: bigint('movedtotodayat', { mode: 'number' }),
  memo: text('memo'),
  scheduledDate: text('scheduled_date'), // YYYY-MM-DD 형식, 해당 날짜에 오늘 할일로 자동 이동
})

/**
 * annual_review 테이블 스키마 정의
 * 연간 회고록 데이터 저장
 */
export const annualReview = pgTable('annual_review', {
  id: uuid('id').defaultRandom().primaryKey(),
  year: text('year').notNull(),
  reviewData: text('reviewdata').notNull(), // JSON 문자열로 저장
  completedDays: text('completeddays').notNull(), // JSON 배열 문자열로 저장
  createdAt: bigint('createdat', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedat', { mode: 'number' }).notNull(),
})

/**
 * project_records 테이블 스키마 정의
 * 프로젝트 기록 데이터 저장
 */
export const projectRecords = pgTable('project_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectName: text('projectname').notNull(),
  type: text('type').notNull(), // MEETING, DECISION, ISSUE, IDEA, RETROSPECT
  date: text('date').notNull(), // YYYY-MM-DD 형식
  title: text('title').notNull(),
  background: text('background'), // Markdown
  discussion: text('discussion'), // Markdown
  problem: text('problem'), // Markdown
  decision: text('decision'), // JSON 문자열 (Decision 객체)
  actionItems: text('actionitems'), // JSON 문자열 (ActionItem[] 배열)
  isMain: boolean('is_main').default(false).notNull(), // 프로젝트별 메인 기록 여부
  createdAt: timestamp('createdat').defaultNow().notNull(),
  updatedAt: timestamp('updatedat').defaultNow().notNull(),
})

/**
 * diaries 테이블 스키마 정의
 * 일기 데이터 저장 (AI 이미지 포함)
 */
/**
 * user_jelly 테이블 — 사용자 젤리 잔액
 */
export const userJelly = pgTable('user_jelly', {
  userId: uuid('user_id').primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * gacha_characters 테이블 — 가챠 포실이 캐릭터
 */
export const gachaCharacters = pgTable('gacha_characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  grade: text('grade').notNull(),
  imageUrl: text('image_url').notNull(),
  dropWeight: bigint('drop_weight', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isCrop: boolean('is_crop').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * user_gacha_pulls 테이블 — 사용자 가챠 뽑기 기록
 */
export const userGachaPulls = pgTable('user_gacha_pulls', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  characterId: uuid('character_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * user_stock_watchlist — 사용자 주식 관심 종목
 */
export const userStockWatchlist = pgTable('user_stock_watchlist', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  symbol: text('symbol').notNull(),
  displayName: text('display_name').notNull(),
  exchange: text('exchange'),
  sortOrder: bigint('sort_order', { mode: 'number' }).default(0).notNull(),
  holdingsQuantity: numeric('holdings_quantity'),
  averagePrice: numeric('average_price'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * weight_records — 사용자 몸무게 일별 기록
 */
export const weightRecords = pgTable('weight_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  recordDate: text('record_date').notNull(),
  weightKg: numeric('weight_kg').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * weight_goals — 사용자 목표 몸무게
 */
export const weightGoals = pgTable('weight_goals', {
  userId: uuid('user_id').primaryKey(),
  targetWeightKg: numeric('target_weight_kg').notNull(),
  targetDate: text('target_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * fridge_items — 냉장고 재고 (냉장실 / 냉동고 / 실온)
 */
export const fridgeItems = pgTable('fridge_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  zone: text('zone').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  status: text('status').notNull().default('active'),
  registeredAt: text('registered_at').notNull(),
  expiresAt: text('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * recipe_ingredient_catalog — 레시피 재료 카탈로그 (공용 + 유저 커스텀)
 */
export const recipeIngredientCatalog = pgTable('recipe_ingredient_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  name: text('name').notNull(),
  category: text('category').notNull(),
  emoji: text('emoji').notNull(),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * recipes — 레시피
 */
export const recipes = pgTable('recipes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  imageUrl: text('image_url'),
  imagePrompt: text('image_prompt'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * recipe_ingredients — 레시피에 포함된 재료
 */
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull(),
  catalogId: uuid('catalog_id'),
  customName: text('custom_name'),
  quantity: integer('quantity').notNull(),
  note: text('note'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * user_farm_progress — 포실이 농장 성장 진행
 */
export const userFarmProgress = pgTable('user_farm_progress', {
  userId: uuid('user_id').primaryKey(),
  stage: bigint('stage', { mode: 'number' }).notNull(),
  xp: bigint('xp', { mode: 'number' }).notNull(),
  farmUnlocked: boolean('farm_unlocked').notNull(),
  activeCharacterId: uuid('active_character_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * user_farm_inventory — 농장 인벤토리 (씨앗 등)
 */
export const userFarmInventory = pgTable('user_farm_inventory', {
  userId: uuid('user_id').primaryKey(),
  seedCount: bigint('seed_count', { mode: 'number' }).notNull(),
  welcomeSeedGranted: boolean('welcome_seed_granted').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * user_farm_stage_seed_grants — 단계 성장 씨앗 지급 이력 (3~10단계)
 */
export const userFarmStageSeedGrants = pgTable(
  'user_farm_stage_seed_grants',
  {
    userId: uuid('user_id').notNull(),
    stage: bigint('stage', { mode: 'number' }).notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.stage] }),
  }),
)

/**
 * farm_field_crops — 농장 밭 작물 (5×4 격자)
 */
export const farmFieldCrops = pgTable('farm_field_crops', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  cellRow: bigint('cell_row', { mode: 'number' }).notNull(),
  cellCol: bigint('cell_col', { mode: 'number' }).notNull(),
  stage: bigint('stage', { mode: 'number' }).notNull(),
  xp: bigint('xp', { mode: 'number' }).notNull(),
  cropGachaCharacterId: uuid('crop_gacha_character_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * farm_warehouse_stock — 수확 작물 창고
 */
export const farmWarehouseStock = pgTable(
  'farm_warehouse_stock',
  {
    userId: uuid('user_id').notNull(),
    cropGachaCharacterId: uuid('crop_gacha_character_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.cropGachaCharacterId] }),
  }),
)

/**
 * farm_crop_requests — 캐릭터 작물 요청 이벤트
 */
export const farmCropRequests = pgTable('farm_crop_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  requesterCharacterId: uuid('requester_character_id').notNull(),
  cropGachaCharacterId: uuid('crop_gacha_character_id').notNull(),
  maxQuantity: integer('max_quantity').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

/**
 * toeic_vocab_day_completions — 토익 단어 Day 완료 횟수
 */
export const toeicVocabDayCompletions = pgTable('toeic_vocab_day_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  dayNumber: integer('day_number').notNull(),
  completionCount: integer('completion_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * toeic_vocab_challenge_goals — 토익 단어 챌린지 목표
 */
export const toeicVocabChallengeGoals = pgTable('toeic_vocab_challenge_goals', {
  userId: uuid('user_id').primaryKey(),
  goal: text('goal').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * toeic_my_vocab_words — 나만의 단어장
 */
export const toeicMyVocabWords = pgTable('toeic_my_vocab_words', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  en: text('en').notNull(),
  ko: text('ko').notNull(),
  checks: integer('checks').default(0).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

/**
 * study_sessions — 포실이 시계 공부 세션
 */
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  studyDate: text('study_date').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  source: text('source').notNull().default('summer-clock'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * menstrual_cycle_settings — 생리 주기 설정
 */
export const menstrualCycleSettings = pgTable('menstrual_cycle_settings', {
  userId: uuid('user_id').primaryKey(),
  cycleLength: integer('cycle_length').notNull(),
  periodLength: integer('period_length').notNull(),
  isEnabled: boolean('is_enabled').notNull(),
  onboardingCompleted: boolean('onboarding_completed').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * menstrual_period_records — 생리 기간 기록
 */
export const menstrualPeriodRecords = pgTable('menstrual_period_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * daily_routines — 매일 오늘 할일로 자동 추가되는 루틴
 */
export const dailyRoutines = pgTable('daily_routines', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull().default('작업'),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  lastAppliedDate: text('last_applied_date'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
})

export const diaries = pgTable('diaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: text('date').notNull().unique(), // YYYY-MM-DD 형식
  content: text('content').notNull(),
  imageUrl: text('image_url'), // 생성된 이미지 URL
  imagePrompt: text('image_prompt'), // 사용된 프롬프트
  emotion: text('emotion'), // 감정 분석 결과
  createdAt: timestamp('createdat').defaultNow().notNull(),
  updatedAt: timestamp('updatedat').defaultNow().notNull(),
})

