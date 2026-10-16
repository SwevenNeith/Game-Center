-- Résultats de combat + suppression d’historique.
-- À coller dans Supabase → SQL Editor, puis Run (ré-exécutable sans danger).

alter table public.game_matches
  add column if not exists battle_results jsonb;

drop policy if exists "game_matches_update" on public.game_matches;

create policy "game_matches_update"
  on public.game_matches
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "game_matches_delete" on public.game_matches;

create policy "game_matches_delete"
  on public.game_matches
  for delete
  to anon, authenticated
  using (true);
