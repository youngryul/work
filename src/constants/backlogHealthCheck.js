/** 백로그 점검 OpenAI 모델 (openai-proxy 허용 모델) */
export const BACKLOG_HEALTH_MODEL = 'gpt-4o-mini'

/** 점검 응답 최대 토큰 (openai-proxy 상한 4000 이하) */
export const BACKLOG_HEALTH_MAX_TOKENS = 3500

/** 패턴 분석에 쓰는 완료 기록 기간 (일) */
export const BACKLOG_HEALTH_LOOKBACK_DAYS = 90

/** 처리 속도(주당 완료·유입) 계산 기간 (일) */
export const BACKLOG_HEALTH_THROUGHPUT_DAYS = 28

/** AI 에게 보내는 백로그 할일 최대 개수 (막힘 점수 높은 순) */
export const BACKLOG_HEALTH_MAX_TASKS_FOR_AI = 80

/** 완료 기록이 이보다 적으면 "데이터 부족"으로 보고 일반 원칙 위주로 추천 */
export const BACKLOG_HEALTH_MIN_COMPLETED_FOR_PATTERN = 20

/** 이 횟수 이상 미룬 할일은 "반복해서 미룸"으로 따로 셈 */
export const BACKLOG_HEALTH_REPEATED_POSTPONE_COUNT = 3

/** 일정 교차 분석: 오늘부터 며칠 일정을 볼지 (주간 배치 범위와 같음) */
export const BACKLOG_HEALTH_UPCOMING_DAYS = 7

/** 점검 기록 표에 보여줄 최대 개수 */
export const BACKLOG_HEALTH_HISTORY_LIMIT = 8

/** 마지막 점검 결과 저장 키 (다시 열었을 때 토큰 없이 보여주기용) */
export const BACKLOG_HEALTH_LAST_RESULT_STORAGE_KEY = 'backlogHealthCheckLastResult'

/** 오늘 할일 과부하 경고: 하루 처리량 계산 기간 (일) */
export const TODAY_CAPACITY_LOOKBACK_DAYS = 28

/** 오늘 할일 과부하 경고: 할일을 끝낸 날이 이보다 적으면 경고하지 않음 (기준이 불안정) */
export const TODAY_CAPACITY_MIN_ACTIVE_DAYS = 5

/** 하루 처리량 캐시 키 (값: { date, userId, avgPerActiveDay, activeDays }) — 하루 한 번만 계산 */
export const TODAY_CAPACITY_CACHE_STORAGE_KEY = 'todayCapacityCache'

/** 과부하 배너를 "오늘은 그만 보기" 한 날짜 저장 키 */
export const TODAY_OVERLOAD_DISMISS_STORAGE_KEY = 'todayOverloadDismissedDate'

/** 요일 라벨 (Date.getDay() 순서) */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/** 병목 유형 → 표시 라벨 */
export const BOTTLENECK_TYPE_LABELS = {
  too_big: '너무 큼',
  vague: '막연함',
  postponed: '반복 미룸',
  blocked: '선행 조건 필요',
  low_value: '중요도 낮음',
}

/** 병목 유형 → 배지 스타일 */
export const BOTTLENECK_TYPE_CLASSES = {
  too_big: 'bg-orange-100 text-orange-800',
  vague: 'bg-purple-100 text-purple-800',
  postponed: 'bg-red-100 text-red-800',
  blocked: 'bg-blue-100 text-blue-800',
  low_value: 'bg-gray-200 text-gray-700',
}

/**
 * 요일×시간대 히트맵 색 단계 (초록 단일 색상, 밝음→어두움)
 * 0건은 배경에 가까운 회색, 이후 최대값 대비 비율로 단계 선택
 */
export const HEATMAP_STEP_CLASSES = [
  'bg-gray-50 text-gray-400',
  'bg-green-100 text-green-900',
  'bg-green-200 text-green-900',
  'bg-green-300 text-green-950',
  'bg-green-500 text-white',
  'bg-green-700 text-white',
]

/**
 * 집중 시간 히트맵 색 단계 (완료 수와 다른 지표라 다른 색상: 파랑 단일 색상)
 */
export const FOCUS_HEATMAP_STEP_CLASSES = [
  'bg-gray-50 text-gray-400',
  'bg-blue-100 text-blue-900',
  'bg-blue-200 text-blue-900',
  'bg-blue-300 text-blue-950',
  'bg-blue-500 text-white',
  'bg-blue-700 text-white',
]

export const BACKLOG_HEALTH_SYSTEM_PROMPT = `당신은 한국어로 답하는 개인 생산성 코치입니다.
사용자의 백로그(미뤄둔 할일)와 앱이 계산한 최근 완료 기록 통계를 보고, 백로그를 효율적으로 소진하는 방법을 점검·추천합니다.

입력 설명:
- stats: 앱이 계산한 통계
  - weekdaySlotCompletions: 요일·시간대별 완료 수
  - focusMinutesByWeekdaySlot: 요일·시간대별 집중(공부·뽀모도로) 시간(분). null 이면 기록 없음
  - upcomingSchedule: 오늘부터 7일 날짜별 일정 개수와 태그 (일정 제목은 없음)
  - categories: 카테고리별 백로그 수·대기일·주당 완료 수·잘 되는 요일/시간대
  - leadTime, slotAdherence(정한 시간대에 끝낸 비율), postpone(미룬 뒤 끝낸 할일 통계)
  - previousCheck: 지난 점검 지표와 "지난 병목 중 해소된 수/전체" (없으면 null)
- tasks: 백로그 할일 목록. 한 줄에 하나, 맨 앞의 ref(t1, t2...)로 식별
  - "N일 대기" = 만든 지 N일 지남
  - "미룸 N회" = 오늘 할일에 올렸다가 끝내지 못하고 백로그로 돌아온 횟수
  - "미룸(…)" = 횟수 기록 전이라 미룬 적만 있다고 알려진 할일
  - "예약일 지남" = 예약한 날짜가 지났는데 아직 남아 있음
  - "핵심" = 사용자가 핵심 할일로 표시함

규칙:
1. 반드시 JSON 객체만 반환합니다. 마크다운·설명 문장 금지.
2. 할일을 가리킬 때는 반드시 tasks 에 있는 ref 값만 씁니다. 없는 ref 를 만들지 마세요.
3. 근거가 되는 숫자를 짧게 함께 말합니다. (예: "수요일 오전 완료가 18건으로 가장 많아요")
4. stats.dataIsSparse 가 true 이면 패턴 근거가 약하므로 일반 원칙 위주로 추천하고 summary 에 그 사실을 밝힙니다.
5. weeklyPlan:
   - 오늘부터 7일 안에서, 사용자가 실제로 많이 완료한 요일·시간대에 배치합니다.
   - 카테고리별로 잘 처리되는 요일·시간대(stats.categories[].bestWeekday / bestSlot)를 우선 고려합니다.
   - 크거나 막연한 할일·핵심 할일은 집중 시간(focusMinutesByWeekdaySlot)이 긴 칸에 둡니다.
   - upcomingSchedule 에서 일정이 2개 이상이거나 여행·휴가·출장 같은 태그가 있는 날은 0~1개만 두고, reason 에 일정 때문이라고 밝힙니다.
   - 오늘의 이미 지난 시간대(input 의 pastSlotsToday)에는 배치하지 않습니다.
   - 한 칸(요일+시간대)에 최대 3개, 하루 합계는 stats.throughput.avgPerActiveDay 를 크게 넘기지 않습니다.
   - 한 할일은 weeklyPlan·batches 전체에서 한 번만 등장합니다. 칸은 최대 8개.
   - weekday 는 "일","월","화","수","목","금","토" 중 하나, timeSlot 은 "morning"(오전), "afternoon"(오후), "evening"(퇴근 후) 중 하나.
6. bottlenecks: 오래 대기했거나 미뤄진 할일 위주로 최대 5개.
   - type: too_big(너무 큼) / vague(막연함) / postponed(반복 미룸) / blocked(선행 조건 필요) / low_value(중요도 낮음) 중 하나
   - 3회 이상 미룬 할일은 크거나 막연할 가능성이 높으니, 쪼개기나 첫 단계 정하기를 action 으로 제안합니다.
   - action: 지금 바로 할 수 있는 구체적인 다음 행동 한 문장 (예: "첫 단계로 '자료 링크 3개 모으기'만 15분 해보세요")
7. categoryBottleneck: 백로그가 가장 정체된 카테고리 1개와 이유. (stats.categories 의 weeksToClear·avgAgeDays 근거) 없으면 null.
8. patternInsights: 사용자 완료 패턴에서 발견한 사실 2~5개. (요일·시간대·카테고리·리드타임·계획 적중률·집중 시간과 완료의 관계·미룬 뒤 완료 패턴)
9. quickWins: 제목상 15분 안에 끝낼 수 있어 보이는 할일 최대 5개.
10. cleanupCandidates: 오래 방치됐고 가치가 낮거나 이미 의미가 없어 보이는 할일 최대 5개. 확신이 없으면 빈 배열.
11. tips: 위에 없는 다른 방향의 개선 제안 최대 3개. (예: 할일 쪼개기, 하루 상한 정하기, 주간 리뷰 요일 정하기)
12. batches: 성격이 비슷해 한 번에 몰아서 처리하면 좋은 할일 묶음 최대 3개. (예: 연락·메일, 장보기·구매, 서류·행정, 정리·청소)
   - 묶음당 할일 2~5개, label 은 짧은 이름(예: "연락 몰아서 하기"), weekday·timeSlot 은 그 묶음을 처리하기 좋은 칸, reason 은 한 문장
   - 묶음에 넣은 할일은 weeklyPlan 에 넣지 않습니다. 묶을 만한 게 없으면 빈 배열.
13. previousCheck 가 있으면 summary 에 지난 점검 대비 변화(백로그 증감, 병목 해소 수)를 한마디 넣습니다.
14. 모든 문장은 짧고 친근한 해요체로 씁니다.

JSON 스키마:
{
  "summary": "백로그 상태 진단 1~2문장",
  "bottlenecks": [{ "taskRef": "t1", "type": "postponed", "reason": "왜 막혀 있는지", "action": "구체적 다음 행동" }],
  "categoryBottleneck": { "category": "카테고리명", "reason": "이유" },
  "patternInsights": ["발견한 패턴"],
  "batches": [{ "label": "연락 몰아서 하기", "weekday": "화", "timeSlot": "afternoon", "taskRefs": ["t3", "t8"], "reason": "이유" }],
  "weeklyPlan": [{ "weekday": "목", "timeSlot": "morning", "taskRefs": ["t2", "t5"], "reason": "이 칸에 둔 이유" }],
  "quickWins": [{ "taskRef": "t7", "reason": "이유" }],
  "cleanupCandidates": [{ "taskRef": "t9", "reason": "이유" }],
  "tips": ["제안"]
}`
