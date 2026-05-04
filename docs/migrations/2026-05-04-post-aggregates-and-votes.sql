-- Phase 2: 게시글 조회/댓글/추천 집계 + post_votes (추천/비추천)
-- Supabase SQL Editor에서 실행. 적용 후 docs/DB_TABLES.md 와 동기화.

create extension if not exists "pgcrypto";

-- 1) posts 집계 컬럼
alter table public.posts
  add column if not exists view_count integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists upvote_count integer not null default 0,
  add column if not exists downvote_count integer not null default 0;

-- 기존 댓글 수 백필
update public.posts p
set comment_count = coalesce(
  (select count(*)::int from public.comments c where c.post_id = p.id),
  0
);

-- 2) 추천/비추천 (글당 유저 1표)
create table if not exists public.post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_post_votes_post_id on public.post_votes(post_id);

alter table public.post_votes enable row level security;

drop policy if exists "Anyone can read post_votes" on public.post_votes;
create policy "Anyone can read post_votes"
  on public.post_votes for select
  using (true);

drop policy if exists "Users insert own post vote" on public.post_votes;
create policy "Users insert own post vote"
  on public.post_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own post vote" on public.post_votes;
create policy "Users update own post vote"
  on public.post_votes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own post vote" on public.post_votes;
create policy "Users delete own post vote"
  on public.post_votes for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3) 투표 변경 시 posts 집계 동기화
create or replace function public.apply_post_vote_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.vote_type = 'up' then
      update public.posts set upvote_count = upvote_count + 1 where id = new.post_id;
    else
      update public.posts set downvote_count = downvote_count + 1 where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.vote_type = 'up' then
      update public.posts set upvote_count = greatest(0, upvote_count - 1) where id = old.post_id;
    else
      update public.posts set downvote_count = greatest(0, downvote_count - 1) where id = old.post_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.vote_type = 'up' and new.vote_type = 'down' then
      update public.posts
      set upvote_count = greatest(0, upvote_count - 1),
          downvote_count = downvote_count + 1
      where id = new.post_id;
    elsif old.vote_type = 'down' and new.vote_type = 'up' then
      update public.posts
      set upvote_count = upvote_count + 1,
          downvote_count = greatest(0, downvote_count - 1)
      where id = new.post_id;
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_post_votes_delta on public.post_votes;
create trigger tr_post_votes_delta
  after insert or update or delete on public.post_votes
  for each row execute function public.apply_post_vote_delta();

-- 4) 댓글 삽입/삭제 시 comment_count
create or replace function public.apply_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tr_comments_count on public.comments;
create trigger tr_comments_count
  after insert or delete on public.comments
  for each row execute function public.apply_post_comment_count();

-- 5) 조회수 RPC (RLS 우회하여 카운트만 증가)
create or replace function public.increment_post_view(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set view_count = view_count + 1 where id = pid;
end;
$$;

grant execute on function public.increment_post_view(uuid) to anon, authenticated;

-- 참고: 커스텀 RPC `get_hybrid_feed` 가 posts 행을 고정 컬럼으로 반환한다면
-- 새 컬럼을 포함하도록 함수 정의를 한 번 갱신해야 할 수 있음.
