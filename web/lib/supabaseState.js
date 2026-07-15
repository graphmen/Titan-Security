import { getLocalState, processLocalAction } from './localStore';
import {
  probeRelationalDb,
  loadAppStateFromRelationalDb,
  saveAppStateToRelationalDb,
  ensureMinimalTenantInDb,
  applyDirectRowDelete,
  applyDirectRowUpsert,
  usesDirectRowUpsert,
  clearTenantOperationalData,
  wipeEntireOperationalDatabase,
  purgeLegacyDemoRowsFromDb,
  isDestructiveDbAction,
  countGuardsInDb,
  getRelationalSummary,
  persistSystemSettingsToDb,
} from './db/relationalDb';
import {
  usesOperationalDbWrite,
  persistOperationalActionToDb,
} from './db/operationalWrites.js';
import { evaluateLicenseExpiryAlerts } from './guards';
import { getWhatsAppStatus } from './whatsapp';
import { getEmailStatus } from './email';
import { deliverPinNotifications } from './pinDeliveryServer';

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

/** Load live data from Supabase into memory for this request only. */
export async function loadFreshStateFromDatabase() {
  await ensureMinimalTenantInDb();
  const state = await loadAppStateFromRelationalDb();
  globalThis.__titanState = state;
  globalThis.__titanFreshLoadAt = Date.now();
  return state;
}

function buildAppStateResponse(state) {
  const tenantId = state.activeTenantId || 'titan';
  evaluateLicenseExpiryAlerts(state, tenantId);
  return {
    ...state,
    dataSource: 'supabase',
    storage: 'relational',
    whatsappStatus: getWhatsAppStatus(),
    emailStatus: getEmailStatus(),
  };
}

export function getStateSummary(state = getLocalState()) {
  return getRelationalSummary(state);
}

/** Save in-memory state to relational tables — only after loadFreshStateFromDatabase in this request. */
export async function persistStateToSupabase() {
  if (!globalThis.__titanFreshLoadAt) {
    throw new Error('Refusing to write stale server memory to the database. Reload from database first.');
  }
  await saveAppStateToRelationalDb(getLocalState());
}

/** Pull latest data from Supabase (never pushes in-memory demo/stale data). */
export async function syncLocalToSupabase() {
  invalidateSupabaseCache();
  const ready = await isSupabaseReady();
  if (!ready) {
    throw new Error(
      'Could not reach the server database. Contact your system administrator.'
    );
  }
  const state = await loadFreshStateFromDatabase();
  const summary = getRelationalSummary(state);
  readyCache = { ok: true, at: Date.now() };
  return {
    summary,
    syncedAt: new Date().toISOString(),
    storage: 'relational',
    direction: 'pull',
  };
}

export async function hydrateStateFromSupabase() {
  await loadFreshStateFromDatabase();
  return true;
}

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

export async function getDbGuardCount() {
  try {
    return await countGuardsInDb();
  } catch {
    return null;
  }
}

/** Every read loads directly from Supabase — no stale server memory. */
export async function getSupabaseAppState() {
  const state = await loadFreshStateFromDatabase();
  const dbGuardCount = await getDbGuardCount();
  return {
    ...buildAppStateResponse(state),
    dbGuardCount,
  };
}

const READ_ONLY_ACTIONS = new Set(['GUARD_LOGIN', 'SUPERVISOR_LOGIN', 'SWITCH_TENANT']);

/** Actions that change guards/premises/etc. and need a relational write after memory update. */
const RELATIONAL_WRITE_ACTIONS = new Set([
  'CREATE_GUARD', 'UPDATE_GUARD', 'RESET_GUARD_PIN', 'CHANGE_GUARD_PIN',
  'CREATE_SHIFT', 'UPDATE_SHIFT',
  'CREATE_PREMISE', 'UPDATE_PREMISE', 'CREATE_PLACE', 'UPDATE_PLACE',
  'CREATE_TERRITORY', 'UPDATE_TERRITORY', 'CREATE_SUPERVISOR', 'UPDATE_SUPERVISOR', 'UPDATE_SUPERVISOR_PHOTO',
  'RESET_SUPERVISOR_PIN', 'CHANGE_SUPERVISOR_PIN',
  'GUARD_CLOCK_IN', 'GUARD_CLOCK_OUT', 'GUARD_HEARTBEAT', 'GUARD_MOVEMENT_ACK',
  'ADD_GUARD_DOCUMENT', 'ADD_GUARD_TRAINING', 'UPDATE_GUARD_PHOTO',
  'REQUEST_SHIFT_SWAP', 'RESOLVE_SHIFT_SWAP', 'DISMISS_GUARD_ALERT',
  'SEND_GUARD_WHATSAPP', 'RESEND_WHATSAPP', 'UPDATE_SYSTEM_SETTINGS',
  'TAP_NFC', 'LOG_INCIDENT', 'UPDATE_INCIDENT_STATUS', 'SUBMIT_CHECKLIST',
  'REGISTER_VISITOR', 'CHECKOUT_VISITOR', 'TRIGGER_SOS', 'CLEAR_SOS',
  'CREATE_TENANT', 'CREATE_CHECKLIST_TEMPLATE', 'RESET_STATE',
]);

export async function runSupabaseAction(payload) {
  invalidateSupabaseCache();
  await loadFreshStateFromDatabase();

  const result = processLocalAction(payload);
  if (result?.error) return result;

  const tenantId = payload.tenantId || getLocalState().activeTenantId || 'titan';
  const destructive = isDestructiveDbAction(payload.action);
  const action = payload.action;

  if (action === 'CLEAR_TENANT_DEMO_DATA') {
    const wipeResult = await wipeEntireOperationalDatabase();
    await purgeLegacyDemoRowsFromDb();
    await ensureMinimalTenantInDb();
    const { whatsapp, email } = await deliverPinNotifications(result, action, tenantId);
    return {
      success: true,
      wiped: true,
      wipeMethod: wipeResult.method,
      whatsapp,
      email,
      state: await loadFreshStateFromDatabase(),
    };
  } else if (destructive) {
    await applyDirectRowDelete(action, payload, tenantId);
  } else if (usesOperationalDbWrite(action)) {
    await persistOperationalActionToDb(action, payload, tenantId, getLocalState());
  } else if (action === 'UPDATE_SYSTEM_SETTINGS') {
    await persistSystemSettingsToDb(getLocalState().systemSettings);
  } else if (!READ_ONLY_ACTIONS.has(action) && RELATIONAL_WRITE_ACTIONS.has(action)) {
    if (usesDirectRowUpsert(action)) {
      await applyDirectRowUpsert(action, payload, tenantId, getLocalState());
    } else {
      await persistStateToSupabase();
    }
  }

  const { whatsapp, email } = await deliverPinNotifications(result, action, tenantId);

  globalThis.__titanFreshLoadAt = null;
  const state = await loadAppStateFromRelationalDb();
  globalThis.__titanState = state;
  globalThis.__titanFreshLoadAt = Date.now();

  if (result?.guard) return { ...result, whatsapp, email, state };
  if (result?.supervisor && !result?.generatedPin) return { ...result, whatsapp, email, state };
  if (result?.generatedPin) return { ...result, whatsapp, email, state };
  if (result?.waLink) return { ...result, whatsapp, email, state };
  return { success: true, whatsapp, email, state };
}
