-- Subscription tier for package gating (Phase 2 = Premium)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'standard';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS premium_activated_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_source text DEFAULT 'default';

COMMENT ON COLUMN public.tenants.subscription_tier IS 'standard | premium — controls Phase 2 feature access';
COMMENT ON COLUMN public.tenants.premium_activated_at IS 'When Premium was activated (token or billing)';
COMMENT ON COLUMN public.tenants.subscription_source IS 'default | token | billing';
