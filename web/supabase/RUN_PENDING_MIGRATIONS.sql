-- Run in Supabase Dashboard → SQL Editor (production fix for guard supervisor assignment)
-- Required for: saving guards with supervisor, bulk assign, dismiss alerts to DB

-- 008: one supervisor per guard
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS supervisor_id text REFERENCES public.supervisors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guards_supervisor ON public.guards(supervisor_id);
COMMENT ON COLUMN public.guards.supervisor_id IS 'The single supervisor responsible for this guard';

-- After running: reload Master Admin → Master Admin tab → Reload from database
