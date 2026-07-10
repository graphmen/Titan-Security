const AUTH_KEY = 'titan_auth_guard_id';
const AUTH_EXP = 'titan_auth_expires';
const SHIFT_MS = 12 * 60 * 60 * 1000;

export const PIN_LENGTH = 6;

/** Demo fallback PINs (6-digit) when offline */
export const DEMO_GUARD_PINS = {
  'GRD-001': '482901',
  'GRD-002': '571023',
};

export function getAuthSession() {
  const guardId = sessionStorage.getItem(AUTH_KEY);
  const expiresAt = Number(sessionStorage.getItem(AUTH_EXP) || 0);
  if (guardId && Date.now() < expiresAt) {
    return { guardId, expiresAt };
  }
  clearAuthSession();
  return null;
}

export function setAuthSession(guardId) {
  sessionStorage.setItem(AUTH_KEY, guardId);
  sessionStorage.setItem(AUTH_EXP, String(Date.now() + SHIFT_MS));
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_EXP);
}

export function findGuardByPinLocal(guards, pin) {
  const code = String(pin || '').trim();
  if (!/^\d{6}$/.test(code)) return null;
  return (guards || []).find((g) => {
    if (g.status !== 'Active') return false;
    const expected = g.loginPin || DEMO_GUARD_PINS[g.id];
    return expected === code;
  }) || null;
}

export function guardInitials(name) {
  return (name || 'G')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Offline / pre-sync fallback for PIN screen */
export const DEMO_FALLBACK_GUARDS = [
  {
    id: 'GRD-001',
    employeeNumber: 'TP-001',
    fullName: 'Officer John Dube',
    suburb: 'Samora Machel',
    status: 'Active',
    loginPin: '482901',
    pinMustChange: false,
  },
  {
    id: 'GRD-002',
    employeeNumber: 'TP-002',
    fullName: 'Officer Sarah Moyo',
    suburb: 'Kuwadzana',
    status: 'Active',
    loginPin: '571023',
    pinMustChange: false,
  },
];
