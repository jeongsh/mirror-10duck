# Supabase Setup (Phase 2.2)

## 0) DB 작업 필수 수칙 (반드시 준수)

아래는 이 프로젝트에서 DB 변경 시 반드시 지켜야 하는 규칙입니다.

- `schema.sql`은 참고용 덤프다. 실행/배포 기준은 항상 `docs/migrations/*.sql`이다.
- **Cursor Supabase MCP**가 연결되어 있으면, 원격 프로젝트 DDL은 MCP `apply_migration`(권장) 또는 `execute_sql`로 적용하고, SQL 본문은 저장소 마이그레이션 파일과 동일하게 맞춘다. 자세한 절차는 [plans/data-model.md](./plans/data-model.md) §0.
- 권한 검사는 UI가 아니라 DB(RLS)가 최종 기준이다. 클라이언트 체크만으로 권한을 보장하지 않는다.
- 관리자 권한 기준은 단일화한다.
  - 기본 기준: JWT role(`app_metadata.role` 또는 `user_metadata.role`)이 `ADMIN`
  - DB 정책은 `private.is_admin()` 같은 공통 함수로 일관되게 사용한다.
- 사용자 식별 FK는 기본적으로 `auth.users(id)`를 기준으로 잡는다.
  - `profiles`는 표시/프로필 정보 용도로 사용하고, 트랜잭션 테이블의 강제 FK를 이중으로 물지 않는다.
- `public` 스키마 테이블은 노출 가능성을 전제로 RLS를 반드시 켠다.
- `INSERT/UPDATE` 정책을 만들 때는 `WITH CHECK`를 반드시 명시한다.
- 정책 변경 시 `DROP POLICY IF EXISTS ...` 후 `CREATE POLICY ...` 순서로 적용해 드리프트를 줄인다.
- 마이그레이션 마지막에는 `notify pgrst, 'reload schema';`를 포함해 스키마 캐시 불일치를 줄인다.
- 파괴적 변경(`DROP TABLE`, `DROP COLUMN`, FK 제거)은 즉시 실행하지 않는다.
  - 1) 사용처 확인 -> 2) 비파괴 마이그레이션 -> 3) 앱 반영 -> 4) 모니터링 -> 5) 최종 제거 순서를 따른다.
- 운영 데이터 대상 DDL은 가능하면 트랜잭션/롤백 계획을 함께 준비하고, 적용 전 백업 스냅샷을 남긴다.

## 1) 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 넣습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## 2) SQL 실행 (Table + RLS)

Supabase SQL Editor에서 아래 SQL을 실행합니다.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  content text not null,
  category text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null
);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Authenticated users can insert posts" on public.posts;
drop policy if exists "Author can update own posts" on public.posts;
drop policy if exists "Author can delete own posts" on public.posts;

create policy "Anyone can read posts"
on public.posts for select
using (true);

create policy "Authenticated users can insert posts"
on public.posts for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Author can update own posts"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Author can delete own posts"
on public.posts for delete
to authenticated
using (auth.uid() = author_id);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  profile_json jsonb not null,
  unique (user_id, character_id)
);

alter table public.characters
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists character_id text,
  add column if not exists profile_json jsonb;

create index if not exists idx_characters_user_id on public.characters(user_id);
create unique index if not exists idx_characters_user_character
  on public.characters(user_id, character_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_characters_updated_at on public.characters;
create trigger trg_characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

alter table public.characters enable row level security;

drop policy if exists "Owner can read characters" on public.characters;
drop policy if exists "Owner can insert characters" on public.characters;
drop policy if exists "Owner can update characters" on public.characters;
drop policy if exists "Owner can delete characters" on public.characters;

create policy "Owner can read characters"
on public.characters for select
to authenticated
using (auth.uid() = user_id);

create policy "Owner can insert characters"
on public.characters for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Owner can update characters"
on public.characters for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Owner can delete characters"
on public.characters for delete
to authenticated
using (auth.uid() = user_id);
```

## 2-1) 이미 구축된 DB 업데이트용 SQL (posts 유지 + characters 추가/보정)

기존 `posts`가 이미 있고, 정책/트리거 중복 에러 없이 최신 구조로 맞추고 싶다면 아래만 실행해도 됩니다.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  profile_json jsonb not null,
  unique (user_id, character_id)
);

alter table public.characters
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists character_id text,
  add column if not exists profile_json jsonb;

create index if not exists idx_characters_user_id on public.characters(user_id);
create unique index if not exists idx_characters_user_character
  on public.characters(user_id, character_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_characters_updated_at on public.characters;
create trigger trg_characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

alter table public.characters enable row level security;

drop policy if exists "Owner can read characters" on public.characters;
drop policy if exists "Owner can insert characters" on public.characters;
drop policy if exists "Owner can update characters" on public.characters;
drop policy if exists "Owner can delete characters" on public.characters;

create policy "Owner can read characters"
on public.characters for select
to authenticated
using (auth.uid() = user_id);

create policy "Owner can insert characters"
on public.characters for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Owner can update characters"
on public.characters for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Owner can delete characters"
on public.characters for delete
to authenticated
using (auth.uid() = user_id);
```

## 3) Storage 버킷 + 정책 (캐릭터 ZIP 업로드용)

업로드된 Live2D 모델 파일들을 Supabase Storage에 영구 보관합니다.

### 3-1) 버킷 생성

Supabase Dashboard → `Storage` → `New bucket`

- 이름: `character-assets`
- Public bucket: ON (모델/텍스처는 Pixi 가 fetch 로 읽어야 하므로 public read 권장)

또는 SQL Editor 에서 한 번에:

```sql
insert into storage.buckets (id, name, public)
values ('character-assets', 'character-assets', true)
on conflict (id) do update set public = excluded.public;
```

### 3-2) Storage RLS 정책

본인 폴더(`${auth.uid()}/...`)에만 쓰기/수정/삭제 가능, 읽기는 누구나 (public bucket).

```sql
drop policy if exists "Anyone can read character-assets" on storage.objects;
drop policy if exists "Owner can insert character-assets" on storage.objects;
drop policy if exists "Owner can update character-assets" on storage.objects;
drop policy if exists "Owner can delete character-assets" on storage.objects;

create policy "Anyone can read character-assets"
on storage.objects for select
using (bucket_id = 'character-assets');

create policy "Owner can insert character-assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'character-assets'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Owner can update character-assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'character-assets'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'character-assets'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Owner can delete character-assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'character-assets'
  and split_part(name, '/', 1) = auth.uid()::text
);
```

### 3-3) 폴더 규칙

```
character-assets/
  ${user_id}/
    ${character_id}/
      <model3.json 의 상대경로 그대로>
```

- `model3.json` 안의 상대 경로(텍스처/모션/표정 등)를 그대로 유지하므로,
  `Live2DModel.from(<storage public url of model3.json>)` 호출 시 같은 base 의
  다른 리소스가 자동으로 함께 fetch 됩니다.

## 4) Phase 2.3 캐릭터-커뮤니티 연결 (Reactions + Comments)

스티커는 라이브러리에 등록된 캐릭터(`public.characters`)를 그대로 소스로 사용하므로 별도 테이블이 필요 없습니다.  
다만 "리액션(좋아요 2.0)" 과 "댓글/스티커 답글" 은 신규 테이블이 필요합니다.

> 그대로 복사해도 되고, 동일 내용을 단일 파일로 정리해 둔  
> [`docs/migrations/2026-04-29-phase23-reactions-comments.sql`](./migrations/2026-04-29-phase23-reactions-comments.sql)
> 를 Supabase SQL Editor 에 한 번만 붙여 넣어 실행해도 됩니다.
>
> 만약 실행 직후에도 클라이언트에서 `Could not find the table 'public.post_reactions' in the schema cache` 에러가 보이면,  
> SQL Editor 에서 `notify pgrst, 'reload schema';` 한 줄만 추가 실행하거나 잠시 후 새로고침 해주세요.  
> (아래 블록 마지막에도 같은 줄이 포함되어 있습니다.)
>
> 이미 과거에 `unique (post_id, user_id, reaction_type)` 형태로 만들어 둔 경우에는,  
> [`docs/migrations/2026-04-29-phase23-reactions-single-per-user.sql`](./migrations/2026-04-29-phase23-reactions-single-per-user.sql)
> 를 한 번만 실행해 **한 글당 한 사용자 1리액션** 정책으로 전환할 수 있습니다.  
> (중복 row 자동 정리 + UNIQUE 키 변경 + 스키마 캐시 리로드 포함)

```sql
create extension if not exists "pgcrypto";

-- 1) post_reactions: 글에 누른 6종 감정 리액션 + 반응자의 캐릭터 썸네일 스냅샷
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (
    reaction_type in ('happy','empathy','surprise','sad','funny','cheer')
  ),
  character_id text,
  character_thumbnail_url text,
  created_at timestamptz not null default now(),
  -- 한 글당 한 사용자 1리액션 정책 (같은 종류 재클릭=해제 / 다른 종류 클릭=교체)
  unique (post_id, user_id)
);

create index if not exists idx_post_reactions_post_id
  on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

drop policy if exists "Anyone can read post_reactions" on public.post_reactions;
drop policy if exists "Authenticated can insert post_reactions" on public.post_reactions;
drop policy if exists "Owner can delete post_reactions" on public.post_reactions;

create policy "Anyone can read post_reactions"
on public.post_reactions for select
using (true);

create policy "Authenticated can insert post_reactions"
on public.post_reactions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Owner can delete post_reactions"
on public.post_reactions for delete
to authenticated
using (auth.uid() = user_id);

-- 2) comments: 텍스트 OR 스티커-only 댓글
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  content text,
  sticker_token text,
  created_at timestamptz not null default now(),
  check (content is not null or sticker_token is not null)
);

create index if not exists idx_comments_post_id
  on public.comments(post_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "Anyone can read comments" on public.comments;
drop policy if exists "Authenticated can insert comments" on public.comments;
drop policy if exists "Author can update comments" on public.comments;
drop policy if exists "Author can delete comments" on public.comments;

create policy "Anyone can read comments"
on public.comments for select
using (true);

create policy "Authenticated can insert comments"
on public.comments for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Author can update comments"
on public.comments for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Author can delete comments"
on public.comments for delete
to authenticated
using (auth.uid() = author_id);

-- PostgREST schema cache 리로드 (없으면 schema cache 미반영 에러가 잠시 뜰 수 있음)
notify pgrst, 'reload schema';
```

`character_thumbnail_url` 은 반응 시점의 스냅샷이라 캐릭터 삭제/교체 후에도 안전하게 표시됩니다.

## 5) 구현된 페이지

- `/auth` - 회원가입/로그인/로그아웃
- `/board` - 게시판 채널 디렉토리
- `/board/[slug]` - 채널별 게시글 목록 + 채널 팔로우
- `/board/[slug]/write` - 게시판 글쓰기 (스티커 삽입 + 미리보기)
- `/board/[slug]/[id]` - 게시글 상세 + 리액션 + 댓글/스티커 답글
- `/feed` - 팔로우 기반 피드 + 인라인 리액션
- `/feed/write` - 피드 글쓰기 (스티커 삽입 + 미리보기)
- `/profile` - 프로필/캐릭터 라이브러리/구독 채널/계정 설정
- `/library/[id]` - 캐릭터 통합 관리 (이름/소개/대사/기본 위치 등)
