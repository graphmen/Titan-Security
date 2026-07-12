/** Quick DB connectivity check — run: node scripts/db-check.mjs */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.DATABASE_URL;
if (!url) {
  console.error('FAIL: DATABASE_URL not set in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
try {
  const client = await pool.connect();
  const tables = ['guards', 'premises', 'territories', 'supervisors', 'tenants', 'titan_state', 'checkpoints'];
  console.log('=== Direct Postgres (DATABASE_URL) ===');
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::int AS n FROM public.${t}`);
    console.log(`${t}: ${r.rows[0].n}`);
  }
  const guards = await client.query('SELECT id, full_name FROM public.guards ORDER BY created_at');
  console.log('guard names:', guards.rows.map((g) => g.full_name).join(', ') || '(none)');
  client.release();
  console.log('OK: connected and queried successfully');
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
