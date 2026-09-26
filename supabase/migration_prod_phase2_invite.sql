-- FASE 2 - PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Additivo e a basso rischio: due funzioni nuove + una piccola aggiunta al
-- trigger protect_coach_managed_fields() (non tocca nessuna RLS esistente,
-- non richiede un momento a basso traffico).
--
-- resolve_team_by_invite_code: dato un codice invito, restituisce id+nome
-- della squadra se esiste ed e' attiva. Concessa anche ad "anon" perche' la
-- pagina di registrazione la chiama PRIMA del login. Non permette di
-- elencare le squadre: serve conoscere gia' il codice esatto.
--
-- claim_team_by_invite_code: unico modo (oltre al super-admin via Table
-- Editor) per valorizzare team_id su un utente. Funziona una sola volta:
-- se l'utente ha gia' una squadra, fallisce.

begin;

create or replace function public.resolve_team_by_invite_code(p_invite_code text)
returns table(id uuid, name text)
language sql
security definer
stable
set search_path = public
as $$
  select t.id, t.name
  from public.teams t
  where t.invite_code = p_invite_code and t.is_active = true;
$$;

grant execute on function public.resolve_team_by_invite_code(text) to anon, authenticated;

create or replace function public.claim_team_by_invite_code(p_invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_current_team uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select team_id into v_current_team from public.users where id = auth.uid();
  if v_current_team is not null then
    raise exception 'user already has a team';
  end if;

  select id into v_team_id from public.teams where invite_code = p_invite_code and is_active = true;
  if v_team_id is null then
    raise exception 'invalid invite code';
  end if;

  perform set_config('app.claiming_team', 'true', true);
  update public.users set team_id = v_team_id where id = auth.uid();
end;
$$;

grant execute on function public.claim_team_by_invite_code(text) to authenticated;

-- Aggiunge il permesso per claim_team_by_invite_code (via il flag di
-- transazione app.claiming_team, leggibile solo lato server e impostato
-- solo da quella funzione) senza allentare la regola generale
-- "solo il super-admin puo' cambiare team_id".
create or replace function public.protect_coach_managed_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_super_admin boolean;
  is_claiming boolean := coalesce(current_setting('app.claiming_team', true), 'false') = 'true';
begin
  if actor is null then
    return new;
  end if;

  actor_is_super_admin := public.is_super_admin();

  if new.team_id is distinct from old.team_id and not actor_is_super_admin and not is_claiming then
    new.team_id := old.team_id;
  end if;

  if new.user_role is distinct from old.user_role
     and (new.user_role = 'admin' or old.user_role = 'admin')
     and not actor_is_super_admin then
    new.user_role := old.user_role;
  end if;

  if not public.is_coach_or_admin() then
    new.user_role := old.user_role;
    new.court_role := old.court_role;
    new.jersey_number := old.jersey_number;
    new.is_active := old.is_active;
    new.email := old.email;
  end if;

  return new;
end;
$$;

commit;

-- Verifica dopo l'esecuzione (sola lettura):
-- select * from public.resolve_team_by_invite_code(
--   (select invite_code from public.teams limit 1)
-- );
-- deve restituire una riga con id e nome della squadra "Dindiats Volley".
