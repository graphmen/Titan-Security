-- Titan Protection — proper relational schema
-- Run in Supabase Dashboard → SQL Editor (after any prior migrations)

-- ── Tenants (may already exist) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  primary_color text DEFAULT '#1b4332',
  logo_text text,
  plan text DEFAULT 'Growth Trial',
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Territories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.territories (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  description text,
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_territories_tenant ON public.territories(tenant_id);

CREATE TABLE IF NOT EXISTS public.territory_suburbs (
  id text PRIMARY KEY,
  territory_id text NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  name text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_territory_suburbs_territory ON public.territory_suburbs(territory_id);

-- ── Supervisors ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supervisors (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_number text,
  full_name text NOT NULL,
  phone text,
  email text,
  role text,
  status text DEFAULT 'Active',
  login_pin text,
  pin_must_change boolean DEFAULT true,
  pin_created_at timestamptz,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supervisors_tenant ON public.supervisors(tenant_id);

CREATE TABLE IF NOT EXISTS public.supervisor_territories (
  supervisor_id text NOT NULL REFERENCES public.supervisors(id) ON DELETE CASCADE,
  territory_id text NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  PRIMARY KEY (supervisor_id, territory_id)
);

-- ── Premises (protected sites) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premises (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  territory_id text REFERENCES public.territories(id) ON DELETE SET NULL,
  name text NOT NULL,
  owner_name text,
  owner_contact text,
  address text,
  city text,
  suburb text,
  lat double precision,
  lng double precision,
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_premises_tenant ON public.premises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_premises_territory ON public.premises(territory_id);

-- ── Places (patrol points / NFC locations within a premise) ─────────────────
CREATE TABLE IF NOT EXISTS public.places (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  premise_id text NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  description text,
  lat double precision,
  lng double precision,
  has_nfc boolean DEFAULT false,
  nfc_code text,
  schedule text DEFAULT 'Every 2 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_places_premise ON public.places(premise_id);
CREATE INDEX IF NOT EXISTS idx_places_tenant ON public.places(tenant_id);

-- ── Guards ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guards (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  territory_id text REFERENCES public.territories(id) ON DELETE SET NULL,
  employee_number text,
  full_name text NOT NULL,
  id_number text,
  phone text,
  email text,
  license_number text,
  license_expiry date,
  grade text,
  status text DEFAULT 'Active',
  city text,
  suburb text,
  uniform_size text,
  photo_url text,
  login_pin text,
  pin_must_change boolean DEFAULT true,
  pin_created_at timestamptz,
  next_of_kin_name text,
  next_of_kin_phone text,
  next_of_kin_relationship text,
  next_of_kin jsonb DEFAULT '{}'::jsonb,
  performance_score jsonb DEFAULT '{}'::jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  trainings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guards_tenant ON public.guards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guards_territory ON public.guards(territory_id);

CREATE TABLE IF NOT EXISTS public.guard_premises (
  guard_id text NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  premise_id text NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  PRIMARY KEY (guard_id, premise_id)
);

-- ── Shifts & attendance ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guard_id text REFERENCES public.guards(id) ON DELETE CASCADE,
  premise_id text REFERENCES public.premises(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  start_time text,
  end_time text,
  shift_type text,
  status text DEFAULT 'Scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON public.shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_guard ON public.shifts(guard_id);

CREATE TABLE IF NOT EXISTS public.guard_attendance (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guard_id text REFERENCES public.guards(id) ON DELETE CASCADE,
  premise_id text REFERENCES public.premises(id) ON DELETE SET NULL,
  shift_id text REFERENCES public.shifts(id) ON DELETE SET NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  status text,
  lat double precision,
  lng double precision,
  last_heartbeat timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.guard_attendance(tenant_id);

-- ── Checkpoints (extend existing table if present) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  status text DEFAULT 'Pending',
  last_scanned timestamptz,
  coords_x integer,
  coords_y integer,
  schedule text,
  premise_id text REFERENCES public.premises(id) ON DELETE SET NULL,
  place_id text REFERENCES public.places(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision
);

ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS premise_id text REFERENCES public.premises(id) ON DELETE SET NULL;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS place_id text REFERENCES public.places(id) ON DELETE SET NULL;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS lng double precision;

-- ── Guard alerts, shift swaps, WhatsApp outbox ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.guard_alerts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guard_id text REFERENCES public.guards(id) ON DELETE CASCADE,
  guard_name text,
  type text NOT NULL,
  severity text DEFAULT 'info',
  message text NOT NULL,
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guard_alerts_tenant ON public.guard_alerts(tenant_id);

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shift_id text REFERENCES public.shifts(id) ON DELETE CASCADE,
  requester_guard_id text REFERENCES public.guards(id) ON DELETE CASCADE,
  target_guard_id text REFERENCES public.guards(id) ON DELETE SET NULL,
  reason text,
  status text DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guard_id text REFERENCES public.guards(id) ON DELETE SET NULL,
  to_phone text,
  message_type text,
  body text,
  wa_link text,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb
);

-- ── App settings (active tenant, etc.) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ── Row Level Security (development — tighten before production) ────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'territories','territory_suburbs','supervisors','supervisor_territories',
    'premises','places','guards','guard_premises','shifts','guard_attendance',
    'guard_alerts','shift_swap_requests','whatsapp_outbox','app_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_anon_all ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_anon_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', tbl);
  END LOOP;
END $$;

-- checkpoints + tenants RLS if not already set
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkpoints_anon_all ON public.checkpoints;
CREATE POLICY checkpoints_anon_all ON public.checkpoints FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.checkpoints TO anon, authenticated, service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_anon_all ON public.tenants;
CREATE POLICY tenants_anon_all ON public.tenants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.tenants TO anon, authenticated, service_role;

COMMENT ON TABLE public.guards IS 'Security guards — linked to tenant, territory, and premises via guard_premises';
COMMENT ON TABLE public.premises IS 'Protected sites under a tenant and territory';
COMMENT ON TABLE public.territories IS 'Operational areas (city/district) containing suburbs';
COMMENT ON TABLE public.supervisors IS 'Area supervisors assigned to territories via supervisor_territories';
