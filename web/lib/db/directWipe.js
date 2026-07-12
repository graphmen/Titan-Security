import pg from 'pg';

const { Pool } = pg;

/** Hard-delete all operational rows — uses direct Postgres when DATABASE_URL is set (bypasses RLS). */
export async function wipeOperationalTablesDirectSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return false;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const statements = [
      'DELETE FROM public.shift_swap_requests',
      'DELETE FROM public.guard_alerts',
      'DELETE FROM public.whatsapp_outbox',
      'DELETE FROM public.guard_attendance',
      'DELETE FROM public.shifts',
      'DELETE FROM public.checkpoints',
      'DELETE FROM public.guard_premises',
      'DELETE FROM public.guards',
      'DELETE FROM public.places',
      'DELETE FROM public.premises',
      'DELETE FROM public.supervisor_territories',
      'DELETE FROM public.supervisors',
      'DELETE FROM public.territory_suburbs',
      'DELETE FROM public.territories',
      'DELETE FROM public.visitors',
      'DELETE FROM public.active_sos_alerts',
      'DELETE FROM public.occurrence_book',
      'DELETE FROM public.checklist_submissions',
      'DELETE FROM public.checklist_templates',
      'DELETE FROM public.titan_state',
      "DELETE FROM public.tenants WHERE id IN ('alpha', 'omega')",
    ];
    for (const sql of statements) {
      await client.query(sql);
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
