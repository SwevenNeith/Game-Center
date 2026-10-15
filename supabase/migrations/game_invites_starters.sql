-- État de partie, matchs sauvegardés, nettoyage des codes expirés.
-- À coller dans Supabase → SQL Editor, puis Run.

alter table public.game_invites
  add column if not exists game_state jsonb,
  add column if not exists host_pick integer,
  add column if not exists guest_pick integer;

create table if not exists public.game_matches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  invite_id uuid unique,
  host_name text not null,
  guest_name text not null,
  host_team jsonb not null default '[]'::jsonb,
  guest_team jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_matches_game_id_idx on public.game_matches (game_id);
create index if not exists game_matches_created_idx on public.game_matches (created_at desc);

alter table public.game_matches enable row level security;

grant select, insert, update, delete
  on table public.game_matches
  to anon, authenticated;

drop policy if exists "game_matches_select" on public.game_matches;
drop policy if exists "game_matches_insert" on public.game_matches;

create policy "game_matches_select"
  on public.game_matches
  for select
  to anon, authenticated
  using (true);

create policy "game_matches_insert"
  on public.game_matches
  for insert
  to anon, authenticated
  with check (true);

-- Codes expirés et inactifs (pas une manche en cours).
create or replace function public.cleanup_expired_game_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.game_invites
  where expires_at < now()
    and coalesce(game_state->>'status', '') not in ('picking', 'info');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.cleanup_expired_game_invites() to anon, authenticated;
