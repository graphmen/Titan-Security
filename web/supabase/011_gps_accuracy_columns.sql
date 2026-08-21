-- 011: persist GPS accuracy on premises and patrol places
ALTER TABLE public.premises ADD COLUMN IF NOT EXISTS accuracy_meters integer;
ALTER TABLE public.premises ADD COLUMN IF NOT EXISTS gps_captured_at timestamptz;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS accuracy_meters integer;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS gps_captured_at timestamptz;
