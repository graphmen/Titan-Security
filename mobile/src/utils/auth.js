const AUTH_KEY = 'titan_auth_guard_id';
const AUTH_EXP = 'titan_auth_expires';
const SHIFT_MS = 12 * 60 * 60 * 1000;

export const PIN_LENGTH = 6;

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

export function guardInitials(name) {
  return (name || 'G')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
