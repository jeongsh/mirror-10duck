-- Temporary viral oshi card shares. All shares expire after 30 days.

insert into storage.buckets (id, name, public)
values ('oshi-card-shares', 'oshi-card-shares', true)
on conflict (id) do update set public = excluded.public;

create table if not exists public.oshi_card_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  nickname text,
  oshi text,
  works text[] not null default '{}'::text[],
  grade text not null,
  type_id text not null,
  background_image_url text,
  oshi_avatar_url text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  constraint oshi_card_shares_expires_30d check (expires_at <= created_at + interval '30 days' + interval '5 minutes')
);

alter table public.oshi_card_shares
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists oshi_card_shares_expires_at_idx
  on public.oshi_card_shares (expires_at);

create index if not exists oshi_card_shares_owner_latest_idx
  on public.oshi_card_shares (owner_id, created_at desc)
  where owner_id is not null;

alter table public.oshi_card_shares enable row level security;

drop policy if exists oshi_card_shares_select_unexpired on public.oshi_card_shares;
create policy oshi_card_shares_select_unexpired
  on public.oshi_card_shares
  for select
  using (expires_at > now());

drop policy if exists oshi_card_shares_insert_anyone on public.oshi_card_shares;
create policy oshi_card_shares_insert_anyone
  on public.oshi_card_shares
  for insert
  with check (
    expires_at <= now() + interval '30 days' + interval '5 minutes'
    and (owner_id is null or owner_id = auth.uid())
  );

drop policy if exists oshi_card_share_assets_public_read on storage.objects;
create policy oshi_card_share_assets_public_read
  on storage.objects
  for select
  using (bucket_id = 'oshi-card-shares');

drop policy if exists oshi_card_share_assets_insert_anyone on storage.objects;
create policy oshi_card_share_assets_insert_anyone
  on storage.objects
  for insert
  with check (bucket_id = 'oshi-card-shares');

drop policy if exists oshi_card_share_assets_update_anyone on storage.objects;
create policy oshi_card_share_assets_update_anyone
  on storage.objects
  for update
  using (bucket_id = 'oshi-card-shares')
  with check (bucket_id = 'oshi-card-shares');

-- Optional cleanup job for later:
-- delete from public.oshi_card_shares where expires_at < now();
