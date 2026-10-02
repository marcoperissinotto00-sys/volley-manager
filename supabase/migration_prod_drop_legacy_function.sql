-- PRODUZIONE (tiptebdhkdopqlnaicwy)
--
-- Pulizia: is_coach_or_admin() è la funzione originale pre-multi-squadra,
-- sostituita da is_coach_of_my_team()/is_super_admin()/my_team_id() nello
-- STEP 2 della migrazione multi-tenant. Nessuna policy RLS la usa più
-- (verificato: nessuna query su pg_policies la referenzia). Rimozione
-- additiva/sicura, nessun comportamento cambia.

drop function if exists public.is_coach_or_admin();
