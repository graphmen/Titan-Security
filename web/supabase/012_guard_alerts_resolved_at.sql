-- Persist supervisor dismiss timestamp on guard alerts
ALTER TABLE public.guard_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
