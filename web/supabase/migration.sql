-- Titan Protection — full app state persistence
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS public.titan_state (
  id text PRIMARY KEY DEFAULT 'global',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.titan_state IS 'Full Titan Protection platform state (guards, premises, territories, shifts, etc.)';

-- Development: allow API access with anon key (tighten RLS before production)
ALTER TABLE public.titan_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "titan_state_anon_all" ON public.titan_state;
CREATE POLICY "titan_state_anon_all"
  ON public.titan_state
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Optional: grant service role if needed
GRANT ALL ON public.titan_state TO anon, authenticated, service_role;
