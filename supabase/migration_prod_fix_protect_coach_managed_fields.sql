-- PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Fix urgente, stesso giorno di migration_prod_drop_legacy_function.sql:
-- quella migrazione ha eliminato is_coach_or_admin() dando per scontato
-- che non fosse più referenziata da nessuna parte (verificato solo su
-- pg_policies, NON sul corpo delle altre funzioni/trigger). In realtà
-- protect_coach_managed_fields() la chiamava ancora internamente, quindi
-- OGNI UPDATE sulla tabella public.users ha iniziato a fallire con
-- "function public.is_coach_or_admin() does not exist" (scoperto perché
-- un aggiornamento della visita medica di un giocatore da /players è
-- andato in errore).
--
-- Fix: stessa identica funzione, solo con la chiamata sostituita da
-- is_coach_of_my_team() (semanticamente equivalente: entrambe erano
-- "select exists(... user_role in ('coach','admin'))").

begin;

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

  if not public.is_coach_of_my_team() then
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
