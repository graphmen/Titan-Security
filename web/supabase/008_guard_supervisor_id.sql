-- One supervisor per guard (direct assignment)
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS supervisor_id text REFERENCES public.supervisors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guards_supervisor ON public.guards(supervisor_id);

COMMENT ON COLUMN public.guards.supervisor_id IS 'The single supervisor responsible for this guard';
