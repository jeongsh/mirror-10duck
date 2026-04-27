# Supabase Setup (Phase 2.2)

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

## 4) 구현된 페이지

- `/auth` - 회원가입/로그인/로그아웃
- `/community` - 게시글 목록 + 카테고리 필터
- `/community/write` - 글쓰기
- `/community/[id]` - 게시글 상세 + 삭제
- `/community/[id]/edit` - 게시글 수정
- `/library/[id]` - 캐릭터 통합 관리 (이름/소개/대사/기본 위치 등)
