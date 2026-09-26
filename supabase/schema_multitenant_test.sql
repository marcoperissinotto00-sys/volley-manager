-- Schema completo multi-tenant per il progetto Supabase DI TEST
-- (xzkqaufbjntmmevdjnyq). Da incollare ed eseguire in SQL Editor su un
-- progetto vuoto: ricrea l'intero schema attuale della app + le aggiunte
-- per l'isolamento tra squadre (tabella teams, team_id, RLS team-aware).
--
-- NON eseguire questo file sul progetto di produzione (tiptebdhkdopqlnaicwy):
-- lì lo schema esiste gia' e serve una migrazione incrementale separata,
-- che scriveremo dopo aver validato questo schema qui.

-- ============================================================
-- 1. ENUM
-- ============================================================

create type public.user_role as enum ('admin', 'coach', 'player');
create type public.court_role as enum ('palleggiatore', 'schiacciatore', 'opposto', 'centrale', 'libero');
create type public.event_type as enum ('training', 'match', 'event');
create type public.attendance_status as enum ('present', 'absent', 'late', 'maybe');

-- ============================================================
-- 2. TABELLE
-- ============================================================

-- teams: created_by aggiunto come FK dopo aver creato la tabella users,
-- per evitare la dipendenza circolare in fase di creazione.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name varchar,
  last_name varchar,
  email varchar,
  user_role public.user_role not null default 'player',
  court_role public.court_role,
  jersey_number int4,
  is_active boolean not null default false,
  avatar_url text,
  team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);

alter table public.teams
  add constraint teams_created_by_fkey foreign key (created_by) references public.users(id);

create table public.athlete_details (
  user_id uuid primary key references public.users(id) on delete cascade,
  codice_fiscale varchar,
  sesso varchar,
  data_nascita date,
  luogo_nascita varchar,
  prov_nascita varchar,
  indirizzo_residenza varchar,
  cap varchar,
  citta_residenza varchar,
  prov_residenza varchar,
  cellulare varchar,
  scadenza_visita_medica date,
  addetto_dae boolean not null default false,
  scadenza_dae date,
  addetto_antincendio boolean not null default false,
  scadenza_antincendio date
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title varchar,
  event_type public.event_type not null,
  date_time timestamptz not null,
  location varchar,
  notes text,
  opponent_name varchar,
  is_home_game boolean,
  latitude double precision,
  longitude double precision,
  maps_url text,
  created_by uuid references public.users(id),
  team_id uuid not null references public.teams(id)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id),
  status public.attendance_status,
  checked_in boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  opponent_name varchar,
  is_home_game boolean,
  sets_won int4,
  sets_lost int4,
  notes text
);

create table public.match_set_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id),
  set_number int4 not null,
  played_as_libero boolean not null default false,
  is_starter boolean not null default true
);

create index users_team_id_idx on public.users(team_id);
create index events_team_id_idx on public.events(team_id);
create index attendances_event_id_idx on public.attendances(event_id);
create index match_set_stats_match_id_idx on public.match_set_stats(match_id);

-- ============================================================
-- 3. FUNZIONI DI SUPPORTO PER LE RLS (SECURITY DEFINER per evitare
--    ricorsione infinita quando una policy su "users" deve leggere "users")
-- ============================================================

create or replace function public.my_team_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.users where id = auth.uid() and user_role = 'admin'
  );
$$;

create or replace function public.is_coach_of_my_team()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.users where id = auth.uid() and user_role = 'coach'
  );
$$;

-- ============================================================
-- 4. TRIGGER
-- ============================================================

-- Crea la riga public.users al momento della registrazione (email/password
-- o Google). team_id resta sempre NULL qui: la fase 2 introdurra' una
-- funzione RPC dedicata (claim_team_by_invite_code) come unico modo per
-- valorizzarlo, cosi' un client non puo' auto-assegnarsi una squadra a
-- piacere passando un team_id nei metadata della insert/signUp. Fino ad
-- allora l'assegnazione e' manuale da Table Editor, come oggi la promozione
-- a coach.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.users (id, first_name, last_name, email, user_role, is_active, team_id)
  values (
    new.id,
    coalesce(meta->>'first_name', meta->>'given_name', ''),
    coalesce(meta->>'last_name', meta->>'family_name', ''),
    new.email,
    'player',
    false,
    null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impedisce che un utente modifichi da solo i campi gestiti dal coach o dal
-- super-admin, anche aggirando la UI. Regole aggiunte per il multi-team:
--   - team_id: puo' essere cambiato SOLO dal super-admin (nemmeno il coach
--     della squadra puo' spostare un utente in un'altra squadra)
--   - user_role = 'admin': puo' essere assegnato o revocato SOLO dal
--     super-admin (un coach non puo' auto-promuoversi/promuovere ad admin)
create or replace function public.protect_coach_managed_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_coach boolean;
  actor_is_super_admin boolean;
begin
  -- Nessuna sessione autenticata via app (auth.uid() e' NULL): siamo nel
  -- Table Editor / SQL Editor del dashboard Supabase, l'escape hatch
  -- manuale usato per assegnare squadre e promuovere a coach/admin.
  -- Non applichiamo nessuna restrizione in questo caso.
  if actor is null then
    return new;
  end if;

  actor_is_coach := exists(
    select 1 from public.users where id = actor and user_role = 'coach'
  );
  actor_is_super_admin := public.is_super_admin();

  if new.team_id is distinct from old.team_id and not actor_is_super_admin then
    new.team_id := old.team_id;
  end if;

  if new.user_role is distinct from old.user_role
     and (new.user_role = 'admin' or old.user_role = 'admin')
     and not actor_is_super_admin then
    new.user_role := old.user_role;
  end if;

  if not (actor_is_coach or actor_is_super_admin) then
    new.user_role := old.user_role;
    new.court_role := old.court_role;
    new.jersey_number := old.jersey_number;
    new.is_active := old.is_active;
    new.email := old.email;
  end if;

  return new;
end;
$$;

create trigger protect_coach_managed_fields_trigger
  before update on public.users
  for each row execute function public.protect_coach_managed_fields();

-- Il client non decide mai il team di un evento: viene sempre preso dal
-- team dell'utente che lo crea, cosi' non e' falsificabile lato frontend.
create or replace function public.set_event_team_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.team_id := public.my_team_id();
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger set_event_team_id_trigger
  before insert on public.events
  for each row execute function public.set_event_team_id();

-- ============================================================
-- 5. VISTA medical status (letta da tutti i membri della squadra, non solo
--    dal coach/interessato) - ora filtrata per squadra
-- ============================================================

create or replace view public.athlete_medical_status as
select ad.user_id, ad.scadenza_visita_medica, ad.addetto_dae, ad.scadenza_dae
from public.athlete_details ad
join public.users u on u.id = ad.user_id
where u.team_id = public.my_team_id();

-- ============================================================
-- 6. RLS
-- ============================================================

alter table public.teams enable row level security;
alter table public.users enable row level security;
alter table public.athlete_details enable row level security;
alter table public.events enable row level security;
alter table public.attendances enable row level security;
alter table public.matches enable row level security;
alter table public.match_set_stats enable row level security;

-- teams: solo il super-admin gestisce l'elenco; ogni utente vede la propria
create policy teams_select on public.teams
  for select using (public.is_super_admin() or id = public.my_team_id());
create policy teams_insert on public.teams
  for insert with check (public.is_super_admin());
create policy teams_update on public.teams
  for update using (public.is_super_admin());

-- users: ognuno vede sempre se stesso (anche prima di avere una squadra
-- assegnata, altrimenti la pagina profilo di un neoregistrato resterebbe
-- bloccata: team_id = NULL non e' mai uguale a my_team_id() = NULL), poi i
-- membri della propria squadra; il super-admin vede tutti
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

-- athlete_details: l'interessato o il coach della sua squadra
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

-- events: chiunque nella squadra legge; solo il coach della squadra scrive
create policy events_select on public.events
  for select using (team_id = public.my_team_id());

create policy events_insert on public.events
  for insert with check (public.is_coach_of_my_team());

create policy events_update on public.events
  for update using (public.is_coach_of_my_team() and team_id = public.my_team_id());

create policy events_delete on public.events
  for delete using (public.is_coach_of_my_team() and team_id = public.my_team_id());

-- attendances: si legge se l'evento e' della propria squadra; si scrive il
-- proprio RSVP, oppure (checked_in incluso) il coach per chiunque
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

-- serve anche solo perche' cancellare un evento fa scattare la cascade su
-- attendances, e una cascade resta soggetta alle RLS di questa tabella
create policy attendances_delete on public.attendances
  for delete using (
    exists (select 1 from public.events e where e.id = attendances.event_id and e.team_id = public.my_team_id())
    and public.is_coach_of_my_team()
  );

-- matches: si legge se l'evento e' della propria squadra; scrive solo il coach
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

-- come sopra: serve per far passare la cascade quando si cancella l'evento
create policy matches_delete on public.matches
  for delete using (
    public.is_coach_of_my_team()
    and exists (select 1 from public.events e where e.id = matches.event_id and e.team_id = public.my_team_id())
  );

-- match_set_stats: come matches, passando per matches -> events
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

-- ============================================================
-- 7. GRANT (le RLS filtrano le righe, ma servono comunque i permessi base)
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.teams, public.users, public.athlete_details, public.events,
  public.attendances, public.matches, public.match_set_stats
  to authenticated;
grant select on public.athlete_medical_status to authenticated;

-- ============================================================
-- 8. STORAGE bucket avatars (pubblico in lettura, scrittura solo nella
--    propria cartella {user_id}/... - nessun cambiamento per il multi-team,
--    l'isolamento e' gia' per singolo utente)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_own_write on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_update on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 9. SEED: una squadra di prova, cosi' puoi creare subito utenti di test
--    e verificare l'isolamento creando anche una SECONDA squadra a mano.
-- ============================================================

insert into public.teams (name) values ('Squadra Test A');
insert into public.teams (name) values ('Squadra Test B');

-- Dopo aver eseguito questo script:
-- 1) select * from public.teams;  -- prendi nota dei due id
-- 2) Authentication -> Add user (crea 2-3 utenti finti, es. coachA@test.it,
--    playerA@test.it, coachB@test.it)
-- 3) Table Editor -> public.users: per ciascuno imposta team_id (uno dei due
--    team creati), user_role ('coach' o 'player') e is_active = true
-- 4) Da due browser/finestre in incognito separate, logga come coachA e
--    coachB, crea un evento con ciascuno e verifica che l'altro NON lo veda.
