import { getLocalState, getLocalStateWithMonitoring, processLocalAction } from './localStore';
import {
  probeRelationalDb,
  loadAppStateFromRelationalDb,
  saveAppStateToRelationalDb,
  seedRelationalDbIfEmpty,
  getRelationalSummary,
} from './db/relationalDb';
import { deliverAndSummarize, getWhatsAppStatus } from './whatsapp';

const PROBE_TIMEOUT_MS = 8000;
const CACHE_OK_MS = 30_000;
const CACHE_FAIL_MS = 60_000;

let readyCache = { ok: null, at: 0 };

function withTimeout(promise, ms = PROBE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase request timed out')), ms);
    }),
  ]);
}

export function invalidateSupabaseCache() {
  readyCache = { ok: null, at: 0 };
}

function tenantIdOf(state) {
  return state?.activeTenantId || 'titan';
}

function recordCount(state) {
  if (!state || typeof state !== 'object') return 0;
  const tid = tenantIdOf(state);
  return (
    (state.guards?.[tid] || []).length +
    (state.premises?.[tid] || []).length +
    (state.territories?.[tid] || []).length +
    (state.supervisors?.[tid] || []).length +
    (state.shifts?.[tid] || []).length +
    Object.keys(state.tenants || {}).length
  );
}

export function getStateSummary(state = getLocalState()) {
  return getRelationalSummary(state);
}

/** Load from relational DB into memory. Always prefer DB on cold start. */
export async function hydrateStateFromSupabase() {
  const remote = await loadAppStateFromRelationalDb();
  const remoteCount = recordCount(remote);
  if (remoteCount === 0) return false;

  globalThis.__titanState = remote;
  return true;
}

/** Save in-memory state to relational tables. */
export async function persistStateToSupabase() {
  await saveAppStateToRelationalDb(getLocalState());
}

/** Push current in-memory state to Supabase relational tables. */
export async function syncLocalToSupabase() {
  invalidateSupabaseCache();
  const ready = await isSupabaseReady();
  if (!ready) {
    throw new Error(
      'Could not reach the server database. Contact your system administrator.'
    );
  }
  const summary = getStateSummary();
  await persistStateToSupabase();
  readyCache = { ok: true, at: Date.now() };
  return { summary, syncedAt: new Date().toISOString(), storage: 'relational' };
}

/** Probe relational tables (guards table must exist). */
export async function isSupabaseReady() {
  if (process.env.FORCE_SUPABASE !== '1') return false;

  const now = Date.now();
  const ttl = readyCache.ok ? CACHE_OK_MS : CACHE_FAIL_MS;
  if (readyCache.ok !== null && now - readyCache.at < ttl) {
    return readyCache.ok;
  }

  try {
    await withTimeout(probeRelationalDb());
    readyCache = { ok: true, at: now };
    return true;
  } catch {
    readyCache = { ok: false, at: now };
    return false;
  }
}

export async function getSupabaseAppState() {
  await seedRelationalDbIfEmpty();
  await hydrateStateFromSupabase();
  return {
    ...getLocalStateWithMonitoring(),
    dataSource: 'supabase',
    storage: 'relational',
    whatsappStatus: getWhatsAppStatus(),
  };
}

export async function runSupabaseAction(payload) {
  await hydrateStateFromSupabase();
  const result = processLocalAction(payload);
  if (result?.error) return result;
  const tenantId = payload.tenantId || getLocalState().activeTenantId || 'titan';
  const whatsapp = await deliverAndSummarize(getLocalState(), tenantId, result.whatsappEntryId);
  await persistStateToSupabase();
  if (result?.guard) return { ...result, whatsapp };
  if (result?.generatedPin) return { ...result, whatsapp };
  if (result?.waLink) return { ...result, whatsapp };
  return { success: true, whatsapp, state: getLocalState() };
}
