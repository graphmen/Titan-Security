-- Add dedicated next-of-kin columns to guards (run if you already applied 002_relational_schema.sql)

ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS next_of_kin_name text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS next_of_kin_phone text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS next_of_kin_relationship text;

-- Copy any existing JSON next_of_kin data into the new columns
UPDATE public.guards
SET
  next_of_kin_name = COALESCE(next_of_kin_name, next_of_kin->>'name'),
  next_of_kin_phone = COALESCE(next_of_kin_phone, next_of_kin->>'phone'),
  next_of_kin_relationship = COALESCE(next_of_kin_relationship, next_of_kin->>'relationship')
WHERE next_of_kin IS NOT NULL AND next_of_kin <> '{}'::jsonb;

COMMENT ON COLUMN public.guards.next_of_kin_phone IS 'Emergency contact phone number for the guard''s next of kin';
