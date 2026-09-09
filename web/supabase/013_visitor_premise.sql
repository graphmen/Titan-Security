-- Visitor register: tie check-ins to premises and logging guard
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS premise_id text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS premise_name text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS registered_by_guard_id text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS registered_by_guard_name text;

CREATE INDEX IF NOT EXISTS idx_visitors_premise ON public.visitors(tenant_id, premise_id, status);
