-- Run once in Supabase SQL Editor if demo data keeps reappearing.
-- Clears the legacy JSON blob table (not used by the app anymore, but may hold old seed data).

DELETE FROM public.titan_state;

-- Verify relational tables are empty:
-- SELECT 'guards' AS tbl, count(*) FROM guards
-- UNION ALL SELECT 'premises', count(*) FROM premises
-- UNION ALL SELECT 'territories', count(*) FROM territories;
