# 프로젝트 기록 - 개인 프로젝트 기록 관리

개인 프로젝트의 회의록, 결정사항, 아이디어, 이슈, 회고를 체계적으로 기록하고 관리하는 웹 애플리케이션

## 주요 기능

- **다양한 기록 타입**: 회의록, 결정사항, 이슈, 아이디어, 회고
- **Markdown 지원**: 본문 내용을 Markdown 형식으로 작성 및 미리보기
- **필터 및 검색**: 기록 타입, 키워드, 기간으로 필터링 및 검색
- **결정 사항 관리**: 결정 내용, 이유, 영향 범위 기록
- **Action Items 관리**: 할 일, 기한, 상태(TODO/DOING/DONE) 관리
- **Supabase 연동**: 클라우드 데이터 저장 및 동기화

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

## Supabase 데이터베이스 설정

1. Supabase 프로젝트를 생성합니다.

2. **데이터베이스 테이블 생성**:
   - SQL Editor에서 `supabase-project-records-schema.sql` 파일을 실행합니다.
   - 또는 Drizzle ORM을 사용한 마이그레이션:
     ```bash
     npm run db:generate  # 스키마에서 마이그레이션 파일 생성
     npm run db:push      # 스키마를 데이터베이스에 직접 푸시
     ```

3. **Storage 버킷 생성** (이미지 업로드용):
   - Supabase 대시보드 > Storage > Create a new bucket
   - 버킷 이름: `images`
   - Public bucket: 체크 (공개 접근 허용)
   - 또는 SQL Editor에서 `supabase-storage-setup.sql` 파일을 실행합니다.

4. `.env` 파일에 다음을 설정합니다:
   - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase Anon Key

## 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── RecordMainView.jsx    # 메인 화면 (목록 + 상세)
│   ├── RecordForm.jsx        # 기록 작성/수정 폼
│   ├── RecordList.jsx        # 기록 목록
│   ├── RecordDetail.jsx      # 기록 상세
│   ├── RecordFilters.jsx     # 필터 컴포넌트
│   ├── MarkdownEditor.jsx    # Markdown 에디터
│   └── MarkdownViewer.jsx    # Markdown 뷰어
├── constants/          # 상수 정의
│   └── recordTypes.js       # 기록 타입, 상태 상수
├── config/             # 설정 파일
│   └── supabase.js         # Supabase 클라이언트
├── db/                 # 데이터베이스 스키마
│   └── schema.js           # Drizzle ORM 스키마 정의
├── services/           # 서비스 레이어
│   └── recordService.js     # 기록 CRUD 서비스
└── types/              # 타입 정의
    └── record.js            # Record 타입 정의
```

## 기록 타입

- **MEETING**: 회의록
- **DECISION**: 결정사항
- **ISSUE**: 이슈
- **IDEA**: 아이디어
- **RETROSPECT**: 회고

## Action Item 상태

- **TODO**: 할 일
- **DOING**: 진행 중
- **DONE**: 완료

## 기술 스택

- **React 18**: UI 프레임워크
- **Vite**: 빌드 도구
- **Tailwind CSS**: 스타일링
- **Supabase**: 백엔드 및 데이터베이스
- **Drizzle ORM**: 타입 안전한 데이터베이스 스키마
- **react-markdown**: Markdown 렌더링
- **react-syntax-highlighter**: 코드 하이라이팅
- **date-fns**: 날짜 처리

## Drizzle ORM 명령어

```bash
npm run db:generate  # 스키마 변경사항을 마이그레이션 파일로 생성
npm run db:push      # 스키마를 데이터베이스에 직접 푸시 (개발 환경 권장)
npm run db:studio    # Drizzle Studio로 데이터베이스 확인
```

## 배포

Vercel 등 정적 호스팅 서비스에 배포 가능합니다. 환경 변수를 배포 플랫폼에 설정해야 합니다.
