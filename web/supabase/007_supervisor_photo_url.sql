-- Profile pictures for supervisors (guards already have photo_url)
ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS photo_url text;

NOTIFY pgrst, 'reload schema';
