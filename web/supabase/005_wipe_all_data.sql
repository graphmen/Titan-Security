-- Titan Protection — wipe ALL rows, keep empty table structure
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- This deletes every record (guards, premises, tenants, legacy blob, etc.)
-- then re-creates the single "titan" tenant so the app can start fresh.
-- Tables and columns are NOT dropped — only data is removed.

BEGIN;

-- 1) Child / junction tables first (foreign keys)
DELETE FROM public.shift_swap_requests;
DELETE FROM public.guard_alerts;
DELETE FROM public.whatsapp_outbox;
DELETE FROM public.guard_attendance;
DELETE FROM public.shifts;
DELETE FROM public.checkpoints;
DELETE FROM public.guard_premises;

-- 2) Core entities
DELETE FROM public.guards;
DELETE FROM public.places;
DELETE FROM public.premises;
DELETE FROM public.supervisor_territories;
DELETE FROM public.supervisors;
DELETE FROM public.territory_suburbs;
DELETE FROM public.territories;

-- 3) Other operational tables (if they exist in your project)
DELETE FROM public.visitors;
DELETE FROM public.active_sos_alerts;
DELETE FROM public.occurrence_book;
DELETE FROM public.checklist_submissions;
DELETE FROM public.checklist_templates;

-- 4) Legacy JSON blob + settings + all tenants
DELETE FROM public.titan_state;
DELETE FROM public.app_settings;
DELETE FROM public.tenants;

-- 5) Re-seed minimal Titan tenant (empty — no demo guards/premises)
INSERT INTO public.tenants (id, name, primary_color, logo_text, plan, status)
VALUES ('titan', 'Titan Protection', '#1b4332', 'TP', 'Growth Trial', 'Active');

INSERT INTO public.app_settings (key, value) VALUES
  ('active_tenant_id', '"titan"'::jsonb),
  ('initial_seed_done', 'true'::jsonb),
  ('system_settings', '{
    "companyName": "Titan Protection Security",
    "companyShortName": "Titan",
    "sirenAlertsEnabled": true,
    "geofenceRadiusMeters": 800,
    "noMovementAlertMinutes": 45,
    "licenseExpiryWarningDays": 60
  }'::jsonb);

COMMIT;

-- ── Verify everything is empty ─────────────────────────────────────────────
SELECT 'tenants'            AS table_name, count(*) AS rows FROM public.tenants
UNION ALL SELECT 'guards',              count(*) FROM public.guards
UNION ALL SELECT 'premises',            count(*) FROM public.premises
UNION ALL SELECT 'territories',         count(*) FROM public.territories
UNION ALL SELECT 'supervisors',         count(*) FROM public.supervisors
UNION ALL SELECT 'shifts',              count(*) FROM public.shifts
UNION ALL SELECT 'checkpoints',         count(*) FROM public.checkpoints
UNION ALL SELECT 'guard_alerts',        count(*) FROM public.guard_alerts
UNION ALL SELECT 'titan_state',         count(*) FROM public.titan_state
UNION ALL SELECT 'app_settings',        count(*) FROM public.app_settings
ORDER BY table_name;
