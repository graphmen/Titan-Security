-- Run in Supabase Dashboard → SQL Editor (production fix for guard supervisor assignment)
-- Required for: saving guards with supervisor, bulk assign, dismiss alerts to DB

-- 008: one supervisor per guard
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS supervisor_id text REFERENCES public.supervisors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guards_supervisor ON public.guards(supervisor_id);
COMMENT ON COLUMN public.guards.supervisor_id IS 'The single supervisor responsible for this guard';

-- 009: guard alert context for dismiss dedupe
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS premise_id text;
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS shift_id text;
CREATE INDEX IF NOT EXISTS idx_guard_alerts_dedupe
  ON public.guard_alerts(tenant_id, guard_id, type, premise_id, shift_id, status);

-- After running: reload Master Admin → Master Admin tab → Reload from database

-- 010: subscription tier for Premium / Phase 2 gating
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'standard';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS premium_activated_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_source text DEFAULT 'default';

-- 011: persist GPS accuracy on premises and patrol places
ALTER TABLE public.premises ADD COLUMN IF NOT EXISTS accuracy_meters integer;
ALTER TABLE public.premises ADD COLUMN IF NOT EXISTS gps_captured_at timestamptz;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS accuracy_meters integer;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS gps_captured_at timestamptz;

-- 012: when supervisor dismisses an alert, persist resolved_at
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- 013: visitor check-in at premises (mobile guard + command centre)
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS premise_id text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS premise_name text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS registered_by_guard_id text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS registered_by_guard_name text;
CREATE INDEX IF NOT EXISTS idx_visitors_premise ON public.visitors(tenant_id, premise_id, status);
