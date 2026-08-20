-- Guard alerts: persist premise/shift context so dismiss dedupe survives reloads
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS premise_id text;
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS shift_id text;

CREATE INDEX IF NOT EXISTS idx_guard_alerts_dedupe
  ON public.guard_alerts(tenant_id, guard_id, type, premise_id, shift_id, status);
