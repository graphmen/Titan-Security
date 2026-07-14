/** Apply 006_supervisor_pin_columns.sql — run: node scripts/run-supervisor-pin-migration.mjs */
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

const sqlPath = resolve(__dirname, '../supabase/006_supervisor_pin_columns.sql');
const sql = readFileSync(sqlPath, 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .trim();

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

try {
  const client = await pool.connect();
  await client.query(sql);
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'supervisors'
       AND column_name IN ('login_pin', 'pin_must_change', 'pin_created_at')
     ORDER BY column_name`
  );
  console.log('Migration OK. Supervisor columns:', cols.rows.map((r) => r.column_name).join(', '));
  client.release();
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
