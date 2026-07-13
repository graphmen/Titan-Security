-- Titan Protection — NUCLEAR wipe (empty database, keep table structure)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Uses TRUNCATE ... CASCADE so foreign keys cannot block the wipe.
-- After this, only the empty "titan" tenant exists — no demo guards/premises.

BEGIN;

TRUNCATE TABLE
  public.shift_swap_requests,
  public.guard_alerts,
  public.whatsapp_outbox,
  public.guard_attendance,
  public.shifts,
  public.checkpoints,
  public.guard_premises,
  public.guards,
  public.places,
  public.premises,
  public.supervisor_territories,
  public.supervisors,
  public.territory_suburbs,
  public.territories,
  public.visitors,
  public.active_sos_alerts,
  public.occurrence_book,
  public.checklist_submissions,
  public.checklist_templates,
  public.titan_state,
  public.app_settings,
  public.tenants
RESTART IDENTITY CASCADE;

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

-- Verify (every count should be 0 except tenants=1 and app_settings=3)
SELECT 'tenants'            AS table_name, count(*) AS rows FROM public.tenants
UNION ALL SELECT 'guards',              count(*) FROM public.guards
UNION ALL SELECT 'premises',            count(*) FROM public.premises
UNION ALL SELECT 'places',              count(*) FROM public.places
UNION ALL SELECT 'territories',         count(*) FROM public.territories
UNION ALL SELECT 'territory_suburbs',  count(*) FROM public.territory_suburbs
UNION ALL SELECT 'supervisors',         count(*) FROM public.supervisors
UNION ALL SELECT 'supervisor_territories', count(*) FROM public.supervisor_territories
UNION ALL SELECT 'shifts',              count(*) FROM public.shifts
UNION ALL SELECT 'checkpoints',         count(*) FROM public.checkpoints
UNION ALL SELECT 'titan_state',          count(*) FROM public.titan_state
UNION ALL SELECT 'app_settings',         count(*) FROM public.app_settings
ORDER BY table_name;
