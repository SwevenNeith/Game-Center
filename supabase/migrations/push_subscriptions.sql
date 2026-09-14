-- À coller dans Supabase → SQL Editor, puis Run.
-- Table attendue : id, subscription, created_at
-- L'app n'a pas d'auth : l'anon key doit pouvoir lire / écrire les abonnements.

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription jsonb not null,
  nom text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions
  alter column created_at set default now();

do $$
declare
  id_type text;
begin
  select data_type
    into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'push_subscriptions'
    and column_name = 'id';

  if id_type = 'uuid' then
    execute 'alter table public.push_subscriptions alter column id set default gen_random_uuid()';
  end if;
end $$;

grant select, insert, update, delete
  on table public.push_subscriptions
  to anon, authenticated;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;

create policy "push_subscriptions_select"
  on public.push_subscriptions
  for select
  to anon, authenticated
  using (true);

create policy "push_subscriptions_insert"
  on public.push_subscriptions
  for insert
  to anon, authenticated
  with check (true);

create policy "push_subscriptions_update"
  on public.push_subscriptions
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "push_subscriptions_delete"
  on public.push_subscriptions
  for delete
  to anon, authenticated
  using (true);
