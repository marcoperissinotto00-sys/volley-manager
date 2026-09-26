-- MIGRAZIONE PRODUZIONE (tiptebdhkdopqlnaicwy) - STEP 1 di 2
--
-- Additivo e invisibile: nessuna policy RLS esistente viene toccata, quindi
-- l'app continua a funzionare esattamente come oggi per tutta la squadra
-- attuale. Puo' essere eseguito in qualsiasi momento, non serve un orario
-- a basso traffico.
--
-- Basato sull'introspezione reale del database di produzione fatta il
-- 2026-09-26 (vedi supabase/prod_introspect.sql): l'enum del ruolo si
-- chiama "role_type" (non "user_role" come nello schema di test), e le
-- funzioni/trigger esistenti sono is_coach_or_admin(), handle_new_user(),
-- protect_coach_managed_fields() + trg_protect_coach_managed_fields.
--
-- Dopo questo step, lo STEP 2 (migration_prod_step2_rls_switch.sql) va
-- eseguito a parte, in un momento di basso traffico.

begin;

-- ============================================================
-- 1. Tabella teams + colonne team_id
-- ============================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

alter table public.users add column team_id uuid references public.teams(id);
alter table public.events add column team_id uuid references public.teams(id);

-- ============================================================
-- 2. Seed: la squadra attuale diventa "Dindiats Volley", tutto il
--    contenuto esistente (utenti ed eventi) viene assegnato a lei
-- ============================================================

do $$
declare
  dindiats_team_id uuid;
begin
  insert into public.teams (name) values ('Dindiats Volley')
  returning id into dindiats_team_id;

  update public.users set team_id = dindiats_team_id where team_id is null;
  update public.events set team_id = dindiats_team_id where team_id is null;
end $$;

alter table public.events alter column team_id set not null;

create index users_team_id_idx on public.users(team_id);
create index events_team_id_idx on public.events(team_id);

-- ============================================================
-- 3. Funzioni di supporto per le RLS team-aware (usate solo dallo STEP 2,
--    ma crearle ora e' invisibile e permette di testarle gia' da subito
--    con select public.my_team_id(); ecc. senza toccare le policy)
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
-- 4. protect_coach_managed_fields(): aggiunge le regole per il
--    multi-team, senza cambiare quelle esistenti. Invisibile finche' c'e'
--    una squadra sola (nessuno ha motivo di cambiare team_id oggi).
--
--    Aggiunta importante trovata testando lo schema sul progetto di prova:
--    auth.uid() e' NULL quando si modifica una riga da Table Editor / SQL
--    Editor del dashboard (non c'e' nessuna sessione app). La versione
--    attuale in produzione NON gestisce questo caso: is_coach_or_admin()
--    con auth.uid() = NULL restituisce false, quindi "promuovere a coach da
--    Table Editor" (descritto in CLAUDE.md) in teoria verrebbe silenziosamente
--    annullato dal trigger. Con questa modifica lo risolviamo insieme
--    all'aggiunta delle regole team_id/admin.
-- ============================================================

create or replace function public.protect_coach_managed_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_super_admin boolean;
begin
  if actor is null then
    return new;
  end if;

  actor_is_super_admin := public.is_super_admin();

  if new.team_id is distinct from old.team_id and not actor_is_super_admin then
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

-- ============================================================
-- 5. Nuovo evento -> team_id sempre preso da chi lo crea, non falsificabile
--    lato client. Invisibile ora (c'e' una squadra sola), indispensabile
--    prima dello STEP 2.
-- ============================================================

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
-- 6. Vista medical status filtrata per squadra. Invisibile ora (una sola
--    squadra = filtro sempre vero per tutti).
-- ============================================================

create or replace view public.athlete_medical_status as
select ad.user_id, ad.scadenza_visita_medica, ad.addetto_dae, ad.scadenza_dae
from public.athlete_details ad
join public.users u on u.id = ad.user_id
where u.team_id = public.my_team_id();

-- ============================================================
-- 7. Grant sulla nuova tabella
-- ============================================================

grant select, insert, update, delete on public.teams to authenticated;

commit;

-- Dopo aver eseguito questo file, verifica che l'app funzioni esattamente
-- come prima (nessun cambiamento visibile atteso). Poi, in un momento di
-- basso traffico, esegui migration_prod_step2_rls_switch.sql.
