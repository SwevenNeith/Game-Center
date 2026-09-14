-- Ajoute le nom d'appareil sur push_subscriptions.
-- À coller dans Supabase → SQL Editor, puis Run.

alter table public.push_subscriptions
  add column if not exists nom text;

comment on column public.push_subscriptions.nom is 'Nom lisible de l’appareil (ex. Chrome · Windows)';
