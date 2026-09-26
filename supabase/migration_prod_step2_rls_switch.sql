-- MIGRAZIONE PRODUZIONE (tiptebdhkdopqlnaicwy) - STEP 2 di 2
--
-- QUESTO E' IL PASSAGGIO RISCHIOSO: sostituisce le 17 policy RLS esistenti
-- con quelle nuove, team-aware. Da eseguire SOLO dopo aver gia' applicato
-- migration_prod_step1_additive.sql, e in un momento di basso traffico
-- (nessun allenamento/partita in corso), perche' cambia immediatamente il
-- comportamento per chiunque stia usando l'app in quel momento.
--
-- Finche' esiste una sola squadra (oggi e' cosi', tutti hanno lo stesso
-- team_id "Dindiats Volley" grazie allo step 1) il risultato visibile
-- dovrebbe essere IDENTICO a prima: stessi eventi, stessa rosa. Se qualcosa
-- si rompe qui, e' un bug nella policy, non un problema di dati.
--
-- Subito dopo l'esecuzione: fai un giro veloce nell'app (login, calendario,
-- rosa, gestione partita) prima di considerare chiusa la migrazione.

begin;

-- ============================================================
-- 1. Rimuove le 17 policy attuali (nomi esatti presi da pg_policies il
--    2026-09-26, vedi supabase/prod_introspect.sql)
-- ============================================================

drop policy "Coach/admin gestiscono i dettagli atleti" on public.athlete_details;
drop policy "Coach/admin o l'interessato leggono i dettagli" on public.athlete_details;
drop policy "Interessato o coach/admin leggono i dettagli" on public.athlete_details;
drop policy "athlete_details_own_row" on public.athlete_details;

drop policy "Ognuno gestisce la propria presenza" on public.attendances;
drop policy "Tutti leggono le presenze" on public.attendances;

drop policy "Coach/admin gestiscono gli eventi" on public.events;
drop policy "Tutti leggono gli eventi" on public.events;

drop policy "Coach/admin gestiscono le statistiche" on public.match_set_stats;
drop policy "Tutti leggono le statistiche" on public.match_set_stats;

drop policy "Coach/admin gestiscono le partite" on public.matches;
drop policy "Tutti leggono le partite" on public.matches;

drop policy "Coach e admin gestiscono tutta la rosa" on public.users;
drop policy "Ognuno aggiorna il proprio profilo" on public.users;
drop policy "Utenti autenticati leggono la rosa" on public.users;
drop policy "users_insert_own_row" on public.users;
drop policy "users_update_own_row" on public.users;

-- ============================================================
-- 2. teams: RLS nuova di zecca
-- ============================================================

alter table public.teams enable row level security;

create policy teams_select on public.teams
  for select using (public.is_super_admin() or id = public.my_team_id());
create policy teams_insert on public.teams
  for insert with check (public.is_super_admin());
create policy teams_update on public.teams
  for update using (public.is_super_admin());

-- ============================================================
-- 3. users
-- ============================================================

create policy users_select on public.users
  for select using (
    auth.uid() = id
    or public.is_super_admin()
    or team_id = public.my_team_id()
  );

create policy users_insert_own_row on public.users
  for insert with check (
    auth.uid() = id and user_role = 'player' and is_active = false and team_id is null
  );

create policy users_update on public.users
  for update using (
    auth.uid() = id
    or public.is_super_admin()
    or (public.is_coach_of_my_team() and team_id = public.my_team_id())
  );

create policy users_delete on public.users
  for delete using (
    public.is_super_admin()
    or (public.is_coach_of_my_team() and team_id = public.my_team_id())
  );

-- ============================================================
-- 4. athlete_details
-- ============================================================

create policy athlete_details_select on public.athlete_details
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users u
      where u.id = athlete_details.user_id
        and u.team_id = public.my_team_id()
        and public.is_coach_of_my_team()
    )
  );

create policy athlete_details_insert on public.athlete_details
  for insert with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.users u
      where u.id = athlete_details.user_id
        and u.team_id = public.my_team_id()
        and public.is_coach_of_my_team()
    )
  );

create policy athlete_details_update on public.athlete_details
  for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users u
      where u.id = athlete_details.user_id
        and u.team_id = public.my_team_id()
        and public.is_coach_of_my_team()
    )
  );

-- ============================================================
-- 5. events
-- ============================================================

create policy events_select on public.events
  for select using (team_id = public.my_team_id());

create policy events_insert on public.events
  for insert with check (public.is_coach_of_my_team());

create policy events_update on public.events
  for update using (public.is_coach_of_my_team() and team_id = public.my_team_id());

create policy events_delete on public.events
  for delete using (public.is_coach_of_my_team() and team_id = public.my_team_id());

-- ============================================================
-- 6. attendances
-- ============================================================

create policy attendances_select on public.attendances
  for select using (
    exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
  );

create policy attendances_insert on public.attendances
  for insert with check (
    exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
    and (auth.uid() = user_id or public.is_coach_of_my_team())
  );

create policy attendances_update on public.attendances
  for update using (
    exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
    and (auth.uid() = user_id or public.is_coach_of_my_team())
  );

create policy attendances_delete on public.attendances
  for delete using (
    exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
    and public.is_coach_of_my_team()
  );

-- ============================================================
-- 7. matches
-- ============================================================

create policy matches_select on public.matches
  for select using (
    exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
  );

create policy matches_insert on public.matches
  for insert with check (
    public.is_coach_of_my_team()
    and exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
  );

create policy matches_update on public.matches
  for update using (
    public.is_coach_of_my_team()
    and exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
  );

create policy matches_delete on public.matches
  for delete using (
    public.is_coach_of_my_team()
    and exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
  );

-- ============================================================
-- 8. match_set_stats
-- ============================================================

create policy match_set_stats_select on public.match_set_stats
  for select using (
    exists (
      select 1 from public.matches m
      join public.events e on e.id = m.event_id
      where m.id = match_set_stats.match_id and e.team_id = public.my_team_id()
    )
  );

create policy match_set_stats_insert on public.match_set_stats
  for insert with check (
    public.is_coach_of_my_team()
    and exists (
      select 1 from public.matches m
      join public.events e on e.id = m.event_id
      where m.id = match_set_stats.match_id and e.team_id = public.my_team_id()
    )
  );

create policy match_set_stats_update on public.match_set_stats
  for update using (
    public.is_coach_of_my_team()
    and exists (
      select 1 from public.matches m
      join public.events e on e.id = m.event_id
      where m.id = match_set_stats.match_id and e.team_id = public.my_team_id()
    )
  );

create policy match_set_stats_delete on public.match_set_stats
  for delete using (
    public.is_coach_of_my_team()
    and exists (
      select 1 from public.matches m
      join public.events e on e.id = m.event_id
      where m.id = match_set_stats.match_id and e.team_id = public.my_team_id()
    )
  );

commit;

-- Fatto. Da controllare subito dopo:
-- 1) login come giocatore normale -> vede calendario e rosa come prima
-- 2) login come coach -> crea/modifica un evento, appello, gestione partita
-- 3) /profile -> un utente modifica i propri dati
-- Se tutto e' uguale a prima, la migrazione e' andata a buon fine. A questo
-- punto la squadra esistente e' isolata "in teoria" ma sola: l'isolamento
-- vero si vede solo quando esistera' una seconda squadra (Fase 3/4).
