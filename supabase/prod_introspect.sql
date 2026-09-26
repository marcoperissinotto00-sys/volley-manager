-- Sola lettura: non modifica nulla. Serve per conoscere gli esatti nomi di
-- policy/trigger/funzioni gia' esistenti in produzione, prima di scrivere la
-- migrazione incrementale verso il multi-team.

select tablename, policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
order by event_object_schema, event_object_table, trigger_name;

select routine_name, routine_type, security_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('users','athlete_details','events','attendances','matches','match_set_stats')
order by table_name, ordinal_position;
