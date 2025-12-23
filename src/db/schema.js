import { pgTable, uuid, text, boolean, bigint, timestamp } from 'drizzle-orm/pg-core'

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
export const diaries = pgTable('diaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: text('date').notNull().unique(), // YYYY-MM-DD 형식
  content: text('content').notNull(),
  imageUrl: text('image_url'), // 생성된 이미지 URL
  imagePrompt: text('image_prompt'), // 사용된 프롬프트
  createdAt: timestamp('createdat').defaultNow().notNull(),
  updatedAt: timestamp('updatedat').defaultNow().notNull(),
})

