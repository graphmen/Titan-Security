import pg from 'pg';

const { Pool } = pg;
const STATE_ROW_ID = 'global';

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured in .env.local');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

/** Create titan_state table + RLS policy if missing (safe to run repeatedly). */
export async function ensureTitanStateTable() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.titan_state (
        id text PRIMARY KEY DEFAULT 'global',
        state jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('ALTER TABLE public.titan_state ENABLE ROW LEVEL SECURITY');
    await client.query('DROP POLICY IF EXISTS "titan_state_anon_all" ON public.titan_state');
    await client.query(`
      CREATE POLICY "titan_state_anon_all"
        ON public.titan_state
        FOR ALL
        TO anon, authenticated
        USING (true)
        WITH CHECK (true)
    `);
    await client.query('GRANT ALL ON public.titan_state TO anon, authenticated, service_role');
  } finally {
    client.release();
  }
}

export async function probeTitanStateTable() {
  await ensureTitanStateTable();
  await getPool().query('SELECT id FROM public.titan_state LIMIT 1');
  return true;
}

export async function loadTitanStateFromDb() {
  await ensureTitanStateTable();
  const { rows } = await getPool().query(
    'SELECT state FROM public.titan_state WHERE id = $1',
    [STATE_ROW_ID]
  );
  const state = rows[0]?.state;
  return state && typeof state === 'object' ? state : null;
}

export async function saveTitanStateToDb(state) {
  await ensureTitanStateTable();
  await getPool().query(
    `INSERT INTO public.titan_state (id, state, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE
       SET state = EXCLUDED.state, updated_at = now()`,
    [STATE_ROW_ID, JSON.stringify(state)]
  );
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}
