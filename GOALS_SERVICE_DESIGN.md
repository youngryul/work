# 2026년 목표 관리 서비스 설계 문서

## 📋 서비스 개요

**서비스 목적**: 2026년 새해 목표를 연간 → 월간 → 주간 → 일간으로 분해하여 실제 행동과 회고를 통해 목표 달성을 돕는 개인용 목표 관리 서비스

**핵심 철학**:
1. 목표는 적는 것이 아니라 설계하는 것이다
2. 목표는 항상 행동으로 연결되어야 한다
3. 회고는 선택이 아니라 필수다

---

## 🗂️ 전체 페이지 구성도

```
홈 / 대시보드
├── 연간 목표 영역별 카드 (5개 영역)
│   ├── 커리어
│   ├── 건강
│   ├── 관계
│   ├── 돈
│   └── 성장
├── 연간 목표 진행률 요약
├── 월별 달성 히트맵 (향후 구현)
└── 오늘의 체크리스트

연간 목표 관리
├── 목표 입력 폼
│   ├── 목표 제목
│   ├── 목표 설명 (왜 중요한지)
│   ├── 측정 기준 (정량/정성)
│   ├── 방해 요소
│   └── 대응 전략
└── 목표 수정/삭제

월별 목표 관리
├── 월별 목표 리스트 (최대 3개)
├── 연간 목표와 연결
├── 목표 상태 관리 (진행 중/완료/보류)
└── 월별 진행률 표시

주간/일간 실행 관리
├── 월 목표 → 주간 행동 자동 분해
├── 일간 체크리스트
└── 체크 완료 애니메이션

회고 시스템
├── 월말 회고 작성 (필수)
│   ├── 이번 달 목표 달성률
│   ├── 가장 잘한 선택
│   ├── 실패 원인 (의지 vs 환경)
│   ├── 다음 달 유지할 것
│   └── 다음 달 버릴 것
└── 회고 작성 후 다음 달 목표 등록 가능

통계 & 인사이트 (향후 구현)
├── 목표 달성률 차트
├── 가장 많이 달성한 영역
└── 연속 달성 streak 표시
```

---

## 🎨 핵심 화면 와이어프레임 설명

### 1. 홈 / 연간 대시보드

**레이아웃**:
- 상단: 서비스 타이틀 및 설명
- 중앙: 연간 목표 카드 그리드 (3열)
- 하단: 오늘의 체크리스트

**연간 목표 카드 구성**:
- 영역 아이콘 + 제목
- 진행률 바 (0-100%)
- 상태 배지 (진행 중/완료/보류)
- 측정 기준 미리보기
- 수정/삭제 버튼

### 2. 연간 목표 입력 폼

**필드 구성**:
- 영역 선택 (드롭다운, 최대 5개 제한)
- 목표 제목 (필수)
- 목표 설명 (왜 중요한지)
- 측정 기준 (정량/정성)
- 방해 요소
- 대응 전략

**유효성 검사**:
- 같은 영역 중복 방지
- 최대 5개 제한

### 3. 월별 목표 리스트

**레이아웃**:
- 월 선택 드롭다운
- 목표 리스트 (최대 3개)
- 각 목표 카드:
  - 제목 + 연결된 연간 목표
  - 진행률 바
  - 상태 배지
  - 수정/삭제 버튼

### 4. 일간 체크리스트

**구성**:
- 날짜 표시
- 완료/전체 카운트
- 체크리스트 항목 (체크박스)
- 완료 시 줄 긋기 애니메이션
- 새 항목 추가 입력창

**자동 추가 기능**:
- 주간 행동에서 자동 생성
- 매일 해당 날짜 + 내용으로 오늘 할 일에 추가

### 5. 월별 회고 폼

**구성**:
- 달성률 슬라이더 (0-100%)
- 가장 잘한 선택 (필수)
- 실패 원인 분석 (필수)
- 다음 달 유지할 것
- 다음 달 버릴 것
- 자유 회고

**제약 조건**:
- 회고 작성 전 다음 달 목표 등록 불가

---

## 🗄️ 데이터베이스 ERD 구조

```
users (향후 확장)
  └── user_id

yearly_goals
  ├── id (PK)
  ├── user_id
  ├── year (2026)
  ├── category (CAREER, HEALTH, RELATIONSHIP, MONEY, GROWTH)
  ├── title
  ├── description
  ├── measurement_criteria
  ├── obstacles
  ├── strategy
  ├── progress_percentage
  ├── status (ACTIVE, COMPLETED, PAUSED)
  └── UNIQUE(user_id, year, category)

monthly_goals
  ├── id (PK)
  ├── yearly_goal_id (FK → yearly_goals.id)
  ├── year
  ├── month (1-12)
  ├── title
  ├── description
  ├── status (IN_PROGRESS, COMPLETED, PAUSED)
  ├── progress_percentage
  └── UNIQUE(yearly_goal_id, year, month)

weekly_actions
  ├── id (PK)
  ├── monthly_goal_id (FK → monthly_goals.id)
  ├── year
  ├── month
  ├── week_number (1-5)
  ├── action_text
  ├── is_completed
  └── completed_at

daily_checks
  ├── id (PK)
  ├── weekly_action_id (FK → weekly_actions.id, nullable)
  ├── date (YYYY-MM-DD)
  ├── content
  ├── is_completed
  ├── completed_at
  └── UNIQUE(date, content)

monthly_reflections
  ├── id (PK)
  ├── year
  ├── month (1-12)
  ├── achievement_rate (0-100)
  ├── best_choice
  ├── failure_reason
  ├── keep_next_month
  ├── drop_next_month
  ├── reflection_text
  └── UNIQUE(year, month)
```

**관계**:
- yearly_goals (1) → (N) monthly_goals
- monthly_goals (1) → (N) weekly_actions
- weekly_actions (1) → (N) daily_checks
- monthly_reflections (독립)

---

## 📁 프로젝트 폴더 구조

```
src/
├── components/
│   ├── goals/
│   │   ├── GoalsDashboard.jsx          # 메인 대시보드
│   │   ├── YearlyGoalCard.jsx          # 연간 목표 카드
│   │   ├── YearlyGoalForm.jsx          # 연간 목표 입력 폼
│   │   ├── MonthlyGoalList.jsx        # 월별 목표 리스트
│   │   ├── MonthlyGoalForm.jsx        # 월별 목표 입력 폼
│   │   ├── WeeklyActionList.jsx       # 주간 행동 리스트
│   │   ├── DailyChecklist.jsx         # 일간 체크리스트
│   │   └── MonthlyReflectionForm.jsx  # 월별 회고 폼
│   └── ... (기존 컴포넌트)
├── services/
│   ├── goalService.js                  # 목표 관리 서비스
│   └── ... (기존 서비스)
├── constants/
│   ├── goalCategories.js               # 목표 영역 상수
│   └── ... (기존 상수)
└── ... (기존 구조)
```

---

## 🎯 핵심 기능 구현 상세

### 1. 연간 목표 관리

**제약 조건**:
- 최대 5개 영역
- 영역당 1개 목표
- 영역: 커리어, 건강, 관계, 돈, 성장

**데이터 구조**:
```javascript
{
  id: string,
  year: 2026,
  category: 'CAREER' | 'HEALTH' | 'RELATIONSHIP' | 'MONEY' | 'GROWTH',
  title: string,
  description: string,
  measurementCriteria: string,
  obstacles: string,
  strategy: string,
  progressPercentage: number (0-100),
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
}
```

### 2. 월별 목표 관리

**제약 조건**:
- 최대 3개
- 반드시 연간 목표와 연결
- 회고 작성 후 다음 달 목표 등록 가능

**데이터 구조**:
```javascript
{
  id: string,
  yearlyGoalId: string,
  year: number,
  month: number (1-12),
  title: string,
  description: string,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED',
  progressPercentage: number (0-100)
}
```

### 3. 주간/일간 실행 관리

**자동 분해 로직**:
- 월 목표 → 주간 행동 (4-5주)
- 주간 행동 → 일간 체크리스트 (자동 생성)

**일간 체크리스트 자동 추가**:
- 주간 행동이 있으면 매일 해당 날짜에 자동으로 체크리스트 항목 생성
- 형식: "[날짜] [행동 내용]"

### 4. 회고 시스템

**필수 조건**:
- 월말 회고 작성 필수
- 회고 작성 전 다음 달 목표 등록 불가

**회고 질문**:
1. 이번 달 목표 달성률 (0-100%)
2. 가장 잘한 선택 (필수)
3. 실패 원인 분석 - 의지 vs 환경 (필수)
4. 다음 달 유지할 것
5. 다음 달 버릴 것
6. 자유 회고

---

## 🎨 UX/UI 가이드

### 디자인 톤
- **전체 톤**: 차분하고 자기 성찰적인 느낌
- **컬러**: 뉴트럴 그레이 + 포인트 컬러 (핑크 #EC4899)
- **레이아웃**: 카드 기반, 여백 충분
- **애니메이션**: 체크 완료 시 작은 축하 효과

### 컬러 팔레트
- **Primary**: Pink-400 (#F472B6)
- **Background**: White / Gray-50
- **Text**: Gray-800 / Gray-600
- **Border**: Pink-200 / Gray-200

### 타이포그래피
- **제목**: Bold, 2xl-4xl
- **본문**: Regular, base
- **라벨**: Medium, sm-base
- **폰트**: Sans-serif (기존과 동일)

---

## 🚀 구현 우선순위

### Phase 1 (필수)
1. ✅ 데이터베이스 스키마
2. ✅ 서비스 레이어
3. ✅ 연간 목표 카드
4. ✅ 월별 목표 리스트
5. ✅ 일간 체크리스트
6. ✅ 월별 회고 폼

### Phase 2 (추가)
1. 연간 목표 입력/수정 폼
2. 월별 목표 입력/수정 폼
3. 주간 행동 관리
4. 통계 & 인사이트
5. 월별 달성 히트맵

---

## 📝 사용 가이드

### 1. 연간 목표 등록
1. 대시보드에서 "연간 목표 추가" 클릭
2. 영역 선택 (커리어, 건강, 관계, 돈, 성장)
3. 목표 정보 입력
4. 저장

### 2. 월별 목표 등록
1. 월별 목표 탭으로 이동
2. 월 선택
3. "월별 목표 추가" 클릭
4. 연간 목표와 연결하여 목표 입력
5. 저장

### 3. 일간 체크리스트 사용
1. 대시보드에서 오늘의 체크리스트 확인
2. 주간 행동에서 자동 생성된 항목 체크
3. 필요시 수동으로 항목 추가
4. 완료 시 체크박스 클릭

### 4. 월말 회고 작성
1. 회고 탭으로 이동
2. 해당 월 선택
3. 모든 필수 항목 작성
4. 저장 (다음 달 목표 등록 가능)

---

## 🔧 기술 스택

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Date**: date-fns
- **Deployment**: Vercel (예정)

---

## 📊 성공 지표 (향후 구현)

1. 목표 달성률 추적
2. 연속 달성 streak
3. 영역별 달성 통계
4. 월별 진행률 추이

---

## 🎯 다음 단계

1. App.jsx에 GoalsDashboard 라우팅 추가
2. 연간/월별 목표 입력 폼 구현
3. 주간 행동 자동 분해 로직 구현
4. 통계 대시보드 구현
5. 히트맵 구현

