import { validatePinFormat, normalizeLoginPin, isActivePersonStatus } from './guardAuth.js';

/** Generate a unique 6-digit PIN not used by any guard or supervisor in the tenant. */
export function generateSupervisorPin(guards = [], supervisors = []) {
  const used = new Set([
    ...(guards || []).map((g) => normalizeLoginPin(g.loginPin)),
    ...(supervisors || []).map((s) => normalizeLoginPin(s.loginPin)),
  ].filter(Boolean));
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(pin)) return pin;
  }
  return String(Date.now()).slice(-6).padStart(6, '0');
}

export function findSupervisorByPin(supervisors, pin) {
  const code = normalizeLoginPin(pin);
  if (!code) return null;
  return (supervisors || []).find(
    (s) => isActivePersonStatus(s.status) && normalizeLoginPin(s.loginPin) === code
  ) || null;
}

export { validatePinFormat };
