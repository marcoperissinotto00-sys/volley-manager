-- FASE 3 - PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Un solo statement, additivo: allarga is_coach_of_my_team() in modo che
-- anche un utente con user_role='admin' (il super-admin) venga trattato
-- come allenatore della PROPRIA squadra (team_id), non di tutte. Nessuna
-- policy RLS viene toccata: tutte quelle che usano is_coach_of_my_team()
-- continuano a richiedere ANCHE team_id = my_team_id(), quindi un admin
-- non ottiene accesso alle squadre altrui, solo alla sua (se ne ha una).
--
-- Necessario prima di promuovere qualcuno ad admin se quella persona deve
-- restare anche allenatore della propria squadra (es. il coach attuale di
-- Dindiats Volley che diventa anche super-admin).

begin;

create or replace function public.is_coach_of_my_team()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.users where id = auth.uid() and user_role in ('coach', 'admin')
  );
$$;

commit;

-- Verifica dopo l'esecuzione (sola lettura, come utente admin loggato):
-- select public.is_coach_of_my_team();  -- deve dare true se sei coach o admin
