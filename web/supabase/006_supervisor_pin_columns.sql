-- Supervisor mobile login PINs (mirrors guards.login_pin)
ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS login_pin text,
  ADD COLUMN IF NOT EXISTS pin_must_change boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pin_created_at timestamptz;

COMMENT ON COLUMN public.supervisors.login_pin IS '6-digit PIN for Titan Supervisor mobile app';
