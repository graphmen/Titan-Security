/** Supabase REST connectivity — run: node scripts/supabase-check.mjs */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
function supabaseFetch(url, options = {}) {
  return undiciFetch(url, { ...options, dispatcher: tlsAgent });
}

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon) {
  console.error('FAIL: missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY');
  process.exit(1);
}

const db = createClient(url, service || anon, { global: { fetch: supabaseFetch } });
console.log('Using key:', service ? 'service_role' : 'anon (no SUPABASE_SERVICE_ROLE_KEY)');

const tables = ['guards', 'premises', 'territories', 'supervisors', 'tenants', 'titan_state'];
for (const t of tables) {
  const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${error ? 'ERR ' + error.message : count}`);
}

const { data: guards, error: gErr } = await db.from('guards').select('id, full_name');
if (gErr) console.error('guards list ERR:', gErr.message);
else console.log('guards in DB:', guards?.map((g) => g.full_name).join(', ') || '(none)');

// Test insert + delete round-trip
const testId = 'TEST-CONN-' + Date.now();
const { error: insErr } = await db.from('guards').insert({
  id: testId,
  tenant_id: 'titan',
  full_name: 'Connection Test Guard',
  status: 'Active',
});
if (insErr) {
  console.error('WRITE TEST FAIL:', insErr.message);
} else {
  const { data: check } = await db.from('guards').select('id').eq('id', testId).maybeSingle();
  console.log('WRITE TEST:', check ? 'OK — insert worked' : 'FAIL — row not found after insert');
  await db.from('guards').delete().eq('id', testId);
}
