# Simple Todo - 오늘 할 일

생각 부담을 줄이고 바로 실행할 수 있는 심플한 To-Do 리스트

## 주요 기능

- 오늘 할 일 최대 5개 제한
- 백로그 관리
- 카테고리 분류 (작업, 공부, 생각, 개인)
- Supabase 데이터 저장

## 시작하기

```bash
npm install
npm run dev
```

## 환경 변수 설정

`.env` 파일을 생성하고 Supabase 설정을 추가하세요:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **참고**: 브라우저 환경에서는 Supabase HTTP 클라이언트를 사용하므로, `VITE_DATABASE_URL`은 필요하지 않습니다. Drizzle 스키마는 타입 안전성과 마이그레이션 관리를 위해 사용됩니다.

## Supabase 데이터베이스 설정

1. Supabase 프로젝트를 생성합니다.
2. **데이터베이스 테이블 생성**:
   - SQL Editor에서 다음 파일들을 순서대로 실행합니다:
     1. `supabase-schema.sql` - tasks 테이블 생성
     2. `supabase-categories-init.sql` - categories 테이블 생성 및 기본 카테고리 데이터 삽입
   
   또는 **Drizzle ORM을 사용한 마이그레이션**:
   ```bash
   npm run db:generate  # 스키마에서 마이그레이션 파일 생성
   npm run db:push      # 스키마를 데이터베이스에 직접 푸시
   ```
   (Drizzle을 사용한 경우, `supabase-categories-init.sql`을 수동으로 실행하여 기본 카테고리 데이터를 삽입해야 합니다)

3. `.env` 파일에 다음을 설정합니다:
   - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase Anon Key

## Drizzle ORM 명령어

Drizzle 스키마는 타입 안전성과 마이그레이션 관리를 위해 사용됩니다. 
실제 데이터베이스 작업은 Supabase 클라이언트를 통해 수행됩니다.

```bash
npm run db:generate  # 스키마 변경사항을 마이그레이션 파일로 생성
npm run db:push      # 스키마를 데이터베이스에 직접 푸시 (개발 환경 권장)
npm run db:studio    # Drizzle Studio로 데이터베이스 확인
```

> **참고**: `db:push`를 사용하려면 `drizzle.config.js`에 `DATABASE_URL` 환경 변수가 필요합니다. 
> 이는 개발 환경에서만 사용되며, 프로덕션에서는 Supabase 클라이언트를 통해 데이터에 접근합니다.

## 프로젝트 구조

```
src/
├── components/        # React 컴포넌트
│   ├── TodayView.jsx      # 오늘 할 일 화면
│   ├── BacklogView.jsx    # 백로그 화면
│   └── TaskItem.jsx       # 할 일 항목 컴포넌트
├── constants/         # 상수 정의
│   └── categories.js      # 카테고리 상수
├── config/            # 설정 파일
│   └── supabase.js        # Supabase 클라이언트 및 Drizzle 설정
├── db/                # 데이터베이스 스키마
│   └── schema.js          # Drizzle ORM 스키마 정의
├── services/          # 서비스 레이어
│   └── taskService.js     # 할 일 CRUD 서비스 (Drizzle ORM 사용)
└── types/             # 타입 정의
    └── task.js            # Task 타입 정의
```

## Vercel 배포

### 배포 준비

1. **Vercel 프로젝트 생성**
   - [Vercel](https://vercel.com)에 로그인
   - 새 프로젝트 생성
   - GitHub 저장소 연결

2. **환경 변수 설정**
   Vercel 대시보드의 프로젝트 설정 > Environment Variables에서 다음 환경 변수를 설정하세요:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **배포**
   - Vercel이 자동으로 Vite 프로젝트를 감지하여 빌드 및 배포
   - `vercel.json` 파일이 배포 설정을 관리합니다
   - GitHub에 푸시하면 자동으로 재배포됩니다

### 배포 후 확인사항

- Supabase 데이터베이스 테이블이 생성되어 있는지 확인
- 환경 변수가 올바르게 설정되었는지 확인
- 배포된 URL에서 앱이 정상 작동하는지 확인
- SPA 라우팅이 정상 작동하는지 확인 (모든 경로가 index.html로 리다이렉트)

## 주요 기능 설명

- **오늘 할 일**: 백로그에서 추가 후 오늘 할 일로 이동
- **백로그**: 모든 할 일 관리 및 카테고리별 분류
- **카테고리**: 사용자 정의 카테고리 추가/삭제 가능
- **인라인 수정**: 할 일 텍스트를 클릭하여 바로 수정 가능
- **완료 처리**: 체크박스로 완료/미완료 토글

