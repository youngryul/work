-- 반복 일정 개별 발생분 예외 테이블
-- 특정 발생분만 삭제하거나 제목/태그를 변경할 때 사용합니다.

create table if not exists schedule_exceptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  master_id       uuid not null,          -- schedule_calendar_events.id
  occurrence_date text not null,          -- 원본 발생 날짜 YYYY-MM-DD
  is_deleted      boolean not null default false,
  title           text,                   -- null이면 마스터 제목 사용
  tag             text,                   -- null이면 마스터 태그 사용
  schedule_date   text,                   -- null이면 원본 발생 날짜 사용 (YYYY-MM-DD)
  end_date        text,                   -- null이면 원본 종료 날짜 사용
  created_at      timestamptz default now(),
  unique (master_id, occurrence_date)
);

alter table schedule_exceptions enable row level security;

create policy "사용자 본인 예외만 관리"
  on schedule_exceptions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 이미 테이블이 존재하는 경우 컬럼 추가
alter table schedule_exceptions add column if not exists schedule_date text;
alter table schedule_exceptions add column if not exists end_date text;
