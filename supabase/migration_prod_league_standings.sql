-- PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Classifica del girone (dati esterni, dal sito della lega), aggiornata a
-- mano da Claude su richiesta del coach — non c'e' un fetch live dall'app:
-- il sito sorgente richiede HTTP Basic Auth, quindi una chiamata
-- server-side dall'app non avrebbe le credenziali. Tabella non legata a
-- team_id perche' contiene TUTTE le squadre del girone, non solo la
-- propria.

begin;

create table public.league_standings (
  team varchar primary key,
  pos int4 not null,
  points int4 not null default 0,
  played int4 not null default 0,
  won int4 not null default 0,
  lost int4 not null default 0,
  sets_won int4 not null default 0,
  sets_lost int4 not null default 0,
  set_ratio text,
  points_for int4 not null default 0,
  points_against int4 not null default 0,
  point_ratio text,
  updated_at timestamptz not null default now()
);

alter table public.league_standings enable row level security;

-- Lettura: chiunque sia loggato (vedi grant sotto, nessun accesso anon)
create policy league_standings_select on public.league_standings
  for select using (true);

-- Scrittura: solo il super-admin (e' lui che aggiorna i dati su richiesta)
create policy league_standings_write on public.league_standings
  for insert with check (public.is_super_admin());
create policy league_standings_update on public.league_standings
  for update using (public.is_super_admin());
create policy league_standings_delete on public.league_standings
  for delete using (public.is_super_admin());

grant select, insert, update, delete on public.league_standings to authenticated;

commit;
