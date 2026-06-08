-- 리텐션: 연속 출석 Streak
-- 기획서: docs/plans/retention-streak.md
--
-- 1) user_streaks 테이블 + RLS
-- 2) check_in_streak() RPC (KST 기준 멱등 체크인)
-- 3) badges 시드 7종 (streak_3 / 7 / 14 / 30 / 50 / 100 / 365)
-- 4) grant_streak_badges() RPC (어뷰징 방지용 보상 지급 함수)

-- ---------------------------------------------------------------------------
-- 1. user_streaks 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.user_streaks (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  current_streak       int not null default 0,
  longest_streak       int not null default 0,
  last_check_in_date   date,
  total_check_ins      int not null default 0,
  streak_freeze_count  int not null default 0,
  updated_at           timestamptz not null default now()
);

create index if not exists user_streaks_current_idx
  on public.user_streaks (current_streak desc);

create index if not exists user_streaks_longest_idx
  on public.user_streaks (longest_streak desc);

alter table public.user_streaks enable row level security;

drop policy if exists user_streaks_select_public on public.user_streaks;
create policy user_streaks_select_public
  on public.user_streaks for select
  using (true);

drop policy if exists user_streaks_insert_self on public.user_streaks;
create policy user_streaks_insert_self
  on public.user_streaks for insert
  with check (auth.uid() = user_id);

drop policy if exists user_streaks_update_self on public.user_streaks;
create policy user_streaks_update_self
  on public.user_streaks for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. check_in_streak RPC
-- ---------------------------------------------------------------------------

create or replace function public.check_in_streak()
returns table (
  current_streak     int,
  longest_streak     int,
  last_check_in_date date,
  total_check_ins    int,
  milestone_reached  int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date := (now() at time zone 'Asia/Seoul')::date;
  v_existing  public.user_streaks;
  v_milestone int := null;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select * into v_existing
    from public.user_streaks
   where user_id = v_user_id;

  if v_existing.user_id is null then
    -- 최초 체크인
    insert into public.user_streaks
      (user_id, current_streak, longest_streak, last_check_in_date, total_check_ins)
    values
      (v_user_id, 1, 1, v_today, 1);
    v_milestone := 1;

  elsif v_existing.last_check_in_date = v_today then
    -- 오늘 이미 체크인: 멱등, 변경 없음
    v_milestone := null;

  elsif v_existing.last_check_in_date = v_today - 1 then
    -- 어제 출석 → 연속
    update public.user_streaks
       set current_streak     = v_existing.current_streak + 1,
           longest_streak     = greatest(v_existing.longest_streak, v_existing.current_streak + 1),
           last_check_in_date = v_today,
           total_check_ins    = v_existing.total_check_ins + 1,
           updated_at         = now()
     where user_id = v_user_id;
    v_milestone := v_existing.current_streak + 1;

  else
    -- 끊김 → 1일로 재시작
    update public.user_streaks
       set current_streak     = 1,
           last_check_in_date = v_today,
           total_check_ins    = v_existing.total_check_ins + 1,
           updated_at         = now()
     where user_id = v_user_id;
    v_milestone := 1;
  end if;

  return query
    select s.current_streak,
           s.longest_streak,
           s.last_check_in_date,
           s.total_check_ins,
           v_milestone
      from public.user_streaks s
     where s.user_id = v_user_id;
end;
$$;

grant execute on function public.check_in_streak() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 배지 시드 (streak_days 이정표 7종)
--    기존 badges 패턴을 따라 condition_type 에 'streak_days' 신규 사용.
--    배지 자동 지급 클라이언트 코드(lib/community/badges.ts)에서 분기 추가 예정.
-- ---------------------------------------------------------------------------

insert into public.badges (id, name, description, icon, rarity, condition_type, condition_value)
values
  ('streak_3',   '사흘짜리 다짐',     '연속 출석 3일 달성',   '🔥', 'common',    'streak_days', 3),
  ('streak_7',   '일주일의 약속',     '연속 출석 7일 달성',   '🔥', 'common',    'streak_days', 7),
  ('streak_14',  '본방사수 14일',     '연속 출석 14일 달성',  '🔥', 'rare',      'streak_days', 14),
  ('streak_30',  '한 달 만근개근',    '연속 출석 30일 달성',  '🔥', 'rare',      'streak_days', 30),
  ('streak_50',  '안방 출퇴근러',     '연속 출석 50일 달성',  '🔥', 'epic',      'streak_days', 50),
  ('streak_100', '100일 회차 정주행', '연속 출석 100일 달성', '🔥', 'epic',      'streak_days', 100),
  ('streak_365', '1년차 고인물',      '연속 출석 365일 달성', '🔥', 'legendary', 'streak_days', 365)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. grant_streak_badges RPC
--    클라이언트가 user_badges 에 임의 insert 하는 것을 막기 위해 정의자 권한으로 처리.
--    현재 user_streaks.current_streak 기준으로 미획득 streak 배지를 일괄 지급한다.
-- ---------------------------------------------------------------------------

create or replace function public.grant_streak_badges()
returns table (
  badge_id  text,
  earned_at timestamptz,
  was_new   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current int;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select us.current_streak into v_current
    from public.user_streaks us
   where us.user_id = v_user_id;

  if v_current is null then
    return;
  end if;

  return query
    with eligible as (
      select b.id
        from public.badges b
       where b.condition_type = 'streak_days'
         and b.condition_value <= v_current
    ),
    inserted as (
      insert into public.user_badges (user_id, badge_id)
      select v_user_id, e.id from eligible e
      on conflict (user_id, badge_id) do nothing
      returning user_badges.badge_id, user_badges.earned_at, true as was_new
    ),
    existing as (
      select ub.badge_id, ub.earned_at, false as was_new
        from public.user_badges ub
        join eligible e on e.id = ub.badge_id
       where ub.user_id = v_user_id
         and not exists (select 1 from inserted i where i.badge_id = ub.badge_id)
    )
    select * from inserted
    union all
    select * from existing;
end;
$$;

grant execute on function public.grant_streak_badges() to authenticated;
