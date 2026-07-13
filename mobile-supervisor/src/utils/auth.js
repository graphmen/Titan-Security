const AUTH_KEY = 'titan_auth_supervisor_id';
const AUTH_EXP = 'titan_auth_supervisor_expires';
const SHIFT_MS = 12 * 60 * 60 * 1000;

export const PIN_LENGTH = 6;

export function getAuthSession() {
  const supervisorId = sessionStorage.getItem(AUTH_KEY);
  const expiresAt = Number(sessionStorage.getItem(AUTH_EXP) || 0);
  if (supervisorId && Date.now() < expiresAt) {
    return { supervisorId, expiresAt };
  }
  clearAuthSession();
  return null;
}

export function setAuthSession(supervisorId) {
  sessionStorage.setItem(AUTH_KEY, supervisorId);
  sessionStorage.setItem(AUTH_EXP, String(Date.now() + SHIFT_MS));
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_EXP);
  sessionStorage.removeItem('titan_supervisor_profile');
}

export function personInitials(name) {
  return (name || 'S')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
