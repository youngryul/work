import {
  JELLY_REWARD_DIARY_WRITE,
  JELLY_REWARD_FIVE_YEAR_ANSWER,
  JELLY_REWARD_HABIT_TRACKER_FIRST_TODAY,
  JELLY_REWARD_TASK_COMPLETE,
  JELLY_REWARD_WEIGHT_GOAL_REACHED,
  JELLY_REWARD_WEIGHT_RECORD,
} from './jellyRewards.js'

/** 농장 화면 — 젤리 획득 방법 안내 */
export const JELLY_EARNING_GUIDE = [
  {
    id: 'task',
    icon: '✅',
    label: '할 일 완료',
    description: '오늘 할 일을 완료하면 젤리를 받아요.',
    amount: JELLY_REWARD_TASK_COMPLETE,
  },
  {
    id: 'diary',
    icon: '📔',
    label: '일기 작성',
    description: '하루에 한 번, 일기를 쓰면 젤리를 받아요.',
    amount: JELLY_REWARD_DIARY_WRITE,
  },
  {
    id: 'weight',
    icon: '⚖️',
    label: '몸무게 기록',
    description: '매일 몸무게를 기록하면 젤리를 받아요.',
    amount: JELLY_REWARD_WEIGHT_RECORD,
  },
  {
    id: 'weight_goal',
    icon: '🎯',
    label: '목표 몸무게 달성',
    description: '설정한 목표 몸무게에 도달하면 보너스 젤리를 받아요.',
    amount: JELLY_REWARD_WEIGHT_GOAL_REACHED,
  },
  {
    id: 'five_year',
    icon: '📖',
    label: '5년 질문 답변',
    description: '오늘 질문 첫 답변 3젤리, 다른 날짜 질문 첫 답변 1젤리 (각 1회)',
    amount: JELLY_REWARD_FIVE_YEAR_ANSWER,
  },
  {
    id: 'habit_tracker',
    icon: '📌',
    label: '습관 트래커 달성',
    description: '오늘 달성 2젤리, 이전 날짜 달성 1젤리 (트래커·날짜당 1회)',
    amount: JELLY_REWARD_HABIT_TRACKER_FIRST_TODAY,
  },
]
