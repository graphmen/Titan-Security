import { createHash, timingSafeEqual } from 'node:crypto';
import { findSupervisorByPin } from './supervisorAuth.js';

export const ADMIN_COOKIE = 'titan_admin_session';
export const SUPERVISOR_COOKIE = 'titan_supervisor_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export const PUBLIC_ACTIONS = new Set([
  'GUARD_LOGIN',
  'SUPERVISOR_LOGIN',
  'CHANGE_GUARD_PIN',
  'CHANGE_SUPERVISOR_PIN',
  'GUARD_CLOCK_IN',
  'GUARD_CLOCK_OUT',
  'GUARD_HEARTBEAT',
  'GUARD_MOVEMENT_ACK',
  'TAP_NFC',
  'TRIGGER_SOS',
  'LOG_INCIDENT',
  'SUBMIT_CHECKLIST',
  'REQUEST_SHIFT_SWAP',
]);

export const ADMIN_ONLY_ACTIONS = new Set([
  'CREATE_SUPERVISOR',
  'UPDATE_SUPERVISOR',
  'DELETE_SUPERVISOR',
  'RESET_SUPERVISOR_PIN',
  'CREATE_TERRITORY',
  'UPDATE_TERRITORY',
  'DELETE_TERRITORY',
  'DELETE_GUARD',
  'DELETE_PREMISE',
  'DELETE_PLACE',
  'DELETE_SHIFT',
  'CLEAR_TENANT_DEMO_DATA',
  'UPDATE_SYSTEM_SETTINGS',
  'CREATE_CHECKLIST_TEMPLATE',
  'SYNC_LOCAL_TO_SUPABASE',
  'CREATE_TENANT',
  'RESET_STATE',
  'SWITCH_TENANT',
  'RESEND_WHATSAPP',
]);

export const GUARD_MOBILE_ACTIONS = new Set([
  'GUARD_CLOCK_IN',
  'GUARD_CLOCK_OUT',
  'GUARD_HEARTBEAT',
  'GUARD_MOVEMENT_ACK',
  'TAP_NFC',
  'TRIGGER_SOS',
  'LOG_INCIDENT',
  'SUBMIT_CHECKLIST',
  'REQUEST_SHIFT_SWAP',
  'CHANGE_GUARD_PIN',
  'GUARD_LOGIN',
  'ADD_GUARD_DOCUMENT',
  'ADD_GUARD_TRAINING',
  'UPDATE_GUARD_PHOTO',
]);

function getSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'titan-dev-auth-secret-change-in-production'
  );
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(str) {
  return Buffer.from(str, 'base64url');
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAdminSessionToken(email) {
  return signPayload({ role: 'admin', email: String(email || '').trim().toLowerCase() });
}

export async function createSupervisorSessionToken(supervisorId, tenantId) {
  return signPayload({ role: 'supervisor', supervisorId, tenantId: tenantId || 'titan' });
}

async function signPayload(payload) {
  const body = { ...payload, exp: Date.now() + SESSION_MS };
  const b64 = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const key = await getHmacKey(getSecret());
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(b64));
  return `${b64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [b64, sigB64] = token.split('.');
  try {
    const key = await getHmacKey(getSecret());
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(b64)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(b64)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export async function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '');
  const adminToken = cookies[ADMIN_COOKIE];
  if (adminToken) {
    const session = await verifySessionToken(adminToken);
    if (session?.role === 'admin') return session;
  }
  const supToken = cookies[SUPERVISOR_COOKIE];
  if (supToken) {
    const session = await verifySessionToken(supToken);
    if (session?.role === 'supervisor') return session;
  }
  return null;
}

function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function validateAdminCredentials(email, password) {
  const adminEmail = (process.env.MASTER_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.MASTER_ADMIN_PASSWORD || '';
  if (!adminEmail || !adminPassword) return false;
  const emailOk = safeEqual(String(email || '').trim().toLowerCase(), adminEmail);
  const passOk = safeEqual(String(password || ''), adminPassword);
  return emailOk && passOk;
}

export function isAdminConfigured() {
  return !!(process.env.MASTER_ADMIN_EMAIL?.trim() && process.env.MASTER_ADMIN_PASSWORD);
}

export function verifySupervisorPin(state, tenantId, pin) {
  const supervisor = findSupervisorByPin(state.supervisors?.[tenantId] || [], pin);
  if (!supervisor) return null;
  if (!(supervisor.assignedTerritoryIds || []).length) return null;
  return supervisor;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: Math.floor(SESSION_MS / 1000),
};

export async function authorizeStateMutation(req, action, payload, localState, tenantId) {
  if (PUBLIC_ACTIONS.has(action)) {
    return { ok: true, payload };
  }

  const session = await getSessionFromRequest(req);

  if (ADMIN_ONLY_ACTIONS.has(action)) {
    if (session?.role !== 'admin') {
      return { ok: false, error: 'Master Admin sign-in required', status: 401 };
    }
    return { ok: true, payload, session };
  }

  if (session?.role === 'admin') {
    return { ok: true, payload, session };
  }

  if (session?.role === 'supervisor') {
    const next = { ...payload, supervisorId: session.supervisorId, tenantId: session.tenantId || tenantId };
    return { ok: true, payload: next, session };
  }

  if (payload.supervisorId) {
    return { ok: true, payload };
  }

  if (payload.guardId && GUARD_MOBILE_ACTIONS.has(action)) {
    return { ok: true, payload };
  }

  return { ok: false, error: 'Sign in required', status: 401 };
}
