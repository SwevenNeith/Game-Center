-- Invitations entre appareils (code valable 5 minutes).
-- À coller dans Supabase → SQL Editor, puis Run.

create extension if not exists pgcrypto;

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game_id text not null,
  host_name text not null,
  host_device_id text not null,
  guest_name text,
  guest_device_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  joined_at timestamptz
);

create index if not exists game_invites_code_idx on public.game_invites (code);
create index if not exists game_invites_expires_idx on public.game_invites (expires_at);

alter table public.game_invites enable row level security;

grant select, insert, update, delete
  on table public.game_invites
  to anon, authenticated;

drop policy if exists "game_invites_select" on public.game_invites;
drop policy if exists "game_invites_insert" on public.game_invites;
drop policy if exists "game_invites_update" on public.game_invites;
drop policy if exists "game_invites_delete" on public.game_invites;

create policy "game_invites_select"
  on public.game_invites
  for select
  to anon, authenticated
  using (true);

create policy "game_invites_insert"
  on public.game_invites
  for insert
  to anon, authenticated
  with check (true);

create policy "game_invites_update"
  on public.game_invites
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "game_invites_delete"
  on public.game_invites
  for delete
  to anon, authenticated
  using (true);

-- Temps réel : le hôte voit l’ami rejoindre sans recharger.
alter table public.game_invites replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.game_invites;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
