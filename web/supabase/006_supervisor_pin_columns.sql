-- Supervisor mobile login PINs (mirrors guards.login_pin)
-- Run this in Supabase SQL Editor if supervisor registration fails with
-- "Could not find the 'login_pin' column of 'supervisors' in the schema cache".

ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS login_pin text,
  ADD COLUMN IF NOT EXISTS pin_must_change boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pin_created_at timestamptz;

COMMENT ON COLUMN public.supervisors.login_pin IS '6-digit PIN for Titan Supervisor mobile app';

-- Refresh PostgREST schema cache so the API sees new columns immediately
NOTIFY pgrst, 'reload schema';
