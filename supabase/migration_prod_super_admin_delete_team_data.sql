-- PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Necessario per la nuova funzione "Elimina squadra" in /admin: oggi le
-- policy DELETE su events/matches/attendances/match_set_stats richiedono
-- is_coach_of_my_team() + team_id = my_team_id(), quindi un super-admin
-- che cancella una squadra DIVERSA dalla propria verrebbe bloccato da RLS
-- (0 righe cancellate, nessun errore esplicito — solo dati orfani lasciati
-- indietro). Aggiunge "or is_super_admin()" alle quattro policy, additivo
-- e non riduce l'isolamento tra squadre per nessun altro ruolo.
--
-- Scoperto testando questa stessa migrazione: public.teams non aveva MAI
-- avuto una policy DELETE (solo select/insert/update, dallo STEP 2) — un
-- DELETE su teams tornava status 200 ma cancellava 0 righe, senza errore.
-- Aggiunta qui per lo stesso motivo.

begin;

create policy teams_delete on public.teams
  for delete using (public.is_super_admin());

drop policy events_delete on public.events;
create policy events_delete on public.events
  for delete using (public.is_super_admin() or (public.is_coach_of_my_team() and team_id = public.my_team_id()));

drop policy attendances_delete on public.attendances;
create policy attendances_delete on public.attendances
  for delete using (
    public.is_super_admin()
    or (
      exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
      and public.is_coach_of_my_team()
    )
  );

drop policy matches_delete on public.matches;
create policy matches_delete on public.matches
  for delete using (
    public.is_super_admin()
    or (
      public.is_coach_of_my_team()
      and exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
    )
  );

drop policy match_set_stats_delete on public.match_set_stats;
create policy match_set_stats_delete on public.match_set_stats
  for delete using (
    public.is_super_admin()
    or (
      public.is_coach_of_my_team()
      and exists (
        select 1 from public.matches m
        join public.events e on e.id = m.event_id
        where m.id = match_set_stats.match_id and e.team_id = public.my_team_id()
      )
    )
  );

commit;
