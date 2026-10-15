-- État de partie pour Starter à l’aveugle (noms, manches, équipes).
-- À coller dans Supabase → SQL Editor, puis Run.
-- Inutile d’ajouter host_starters / guest_starters : ce script les remplace.

alter table public.game_invites
  add column if not exists game_state jsonb,
  add column if not exists host_pick integer,
  add column if not exists guest_pick integer;
