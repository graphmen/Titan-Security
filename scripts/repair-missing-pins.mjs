/**
 * One-time repair: assign login PINs to active guards/supervisors missing login_pin in Supabase.
 * Run from web/: node ../scripts/repair-missing-pins.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../web/.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const TENANT_ID = 'titan';

function generatePin(used) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(pin)) return pin;
  }
  throw new Error('Could not generate unique PIN');
}

const { data: guards, error: gErr } = await db
  .from('guards')
  .select('id, full_name, status, login_pin')
  .eq('tenant_id', TENANT_ID);
const { data: supervisors, error: sErr } = await db
  .from('supervisors')
  .select('id, full_name, status, login_pin, email')
  .eq('tenant_id', TENANT_ID);
if (gErr) throw gErr;
if (sErr) throw sErr;

const used = new Set([
  ...(guards || []).map((g) => g.login_pin).filter(Boolean),
  ...(supervisors || []).map((s) => s.login_pin).filter(Boolean),
].map(String));

const repairs = [];

for (const row of [...(guards || []), ...(supervisors || [])]) {
  const active = String(row.status || '').toLowerCase() === 'active';
  const hasPin = row.login_pin != null && String(row.login_pin).trim() !== '';
  if (!active || hasPin) continue;
  const pin = generatePin(used);
  used.add(pin);
  const table = row.email !== undefined ? 'supervisors' : 'guards';
  const { error } = await db.from(table).update({
    login_pin: pin,
    pin_must_change: true,
    pin_created_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (error) throw error;
  repairs.push({ table, name: row.full_name, email: row.email || null, pin });
}

console.log(`Repaired ${repairs.length} account(s):`);
for (const r of repairs) {
  console.log(`- ${r.name} (${r.table}): PIN ${r.pin}${r.email ? ` → ${r.email}` : ''}`);
}
