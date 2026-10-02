-- PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Branding per squadra: logo (caricato dall'allenatore) e regolamento
-- (caricato solo dal super-admin), entrambi finora unici per tutta l'app
-- e impliciti nella squadra "Dindiats Volley".
--
-- Additivo: due colonne nuove su teams, due funzioni nuove, un RPC
-- esistente esteso (resolve_team_by_invite_code), due bucket Storage nuovi.
-- Nessuna RLS esistente viene toccata.

begin;

-- ============================================================
-- 1. Colonne nuove su teams
-- ============================================================

alter table public.teams add column logo_url text;
alter table public.teams add column regolamento_url text;

-- La squadra esistente mantiene il regolamento che ha oggi (file statico
-- in public/documents/), così il link nell'header non si rompe per nessuno.
update public.teams
set regolamento_url = '/documents/norme-partecipazione-giv-tonic-2026-2027.pdf'
where name = 'Dindiats Volley' and regolamento_url is null;

-- ============================================================
-- 2. Lettura pubblica del branding (nome + logo) di una squadra per id.
--    Usata dalla route /api/team-manifest/[teamId] (nessuna sessione
--    utente lato server: la pagina chiama con la chiave anon). Espone
--    solo informazioni non sensibili, e solo a chi conosce già l'id.
-- ============================================================

create or replace function public.get_team_branding(p_team_id uuid)
returns table(name text, logo_url text)
language sql
security definer
stable
set search_path = public
as $$
  select t.name, t.logo_url
  from public.teams t
  where t.id = p_team_id;
$$;

grant execute on function public.get_team_branding(uuid) to anon, authenticated;

-- resolve_team_by_invite_code ora restituisce anche il logo, per mostrarlo
-- già nella pagina di registrazione prima del login. Postgres non permette
-- di cambiare le colonne restituite con CREATE OR REPLACE: va eliminata prima.
drop function if exists public.resolve_team_by_invite_code(text);

create function public.resolve_team_by_invite_code(p_invite_code text)
returns table(id uuid, name text, logo_url text)
language sql
security definer
stable
set search_path = public
as $$
  select t.id, t.name, t.logo_url
  from public.teams t
  where t.invite_code = p_invite_code and t.is_active = true;
$$;

grant execute on function public.resolve_team_by_invite_code(text) to anon, authenticated;

-- ============================================================
-- 3. L'allenatore aggiorna il logo della PROPRIA squadra soltanto
--    (non il nome, non il codice invito, non il regolamento: quelli
--    restano protetti dalla RLS esistente su teams, solo super-admin).
-- ============================================================

create or replace function public.set_my_team_logo(p_logo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_coach_of_my_team() then
    raise exception 'not a coach';
  end if;
  update public.teams set logo_url = p_logo_url where id = public.my_team_id();
end;
$$;

grant execute on function public.set_my_team_logo(text) to authenticated;

-- ============================================================
-- 4. Storage bucket "team-logos": pubblico in lettura, scrittura
--    solo nella cartella della propria squadra e solo da un allenatore.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

create policy team_logos_public_read on storage.objects
  for select using (bucket_id = 'team-logos');

create policy team_logos_coach_write on storage.objects
  for insert with check (
    bucket_id = 'team-logos'
    and public.is_coach_of_my_team()
    and (storage.foldername(name))[1] = public.my_team_id()::text
  );

create policy team_logos_coach_update on storage.objects
  for update using (
    bucket_id = 'team-logos'
    and public.is_coach_of_my_team()
    and (storage.foldername(name))[1] = public.my_team_id()::text
  );

-- ============================================================
-- 5. Storage bucket "team-documents" (regolamento): pubblico in
--    lettura, scrittura solo dal super-admin (qualunque squadra).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('team-documents', 'team-documents', true)
on conflict (id) do nothing;

create policy team_documents_public_read on storage.objects
  for select using (bucket_id = 'team-documents');

create policy team_documents_admin_write on storage.objects
  for insert with check (bucket_id = 'team-documents' and public.is_super_admin());

create policy team_documents_admin_update on storage.objects
  for update using (bucket_id = 'team-documents' and public.is_super_admin());

commit;

-- Verifica dopo l'esecuzione (sola lettura):
-- select * from public.get_team_branding((select id from public.teams limit 1));
-- select * from public.resolve_team_by_invite_code((select invite_code from public.teams limit 1));
-- deve restituire anche logo_url (null finché nessun allenatore carica un logo).
