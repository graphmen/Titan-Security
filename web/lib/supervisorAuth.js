import { validatePinFormat } from './guardAuth.js';

/** Generate a unique 6-digit PIN not used by any guard or supervisor in the tenant. */
export function generateSupervisorPin(guards = [], supervisors = []) {
  const used = new Set([
    ...(guards || []).map((g) => g.loginPin),
    ...(supervisors || []).map((s) => s.loginPin),
  ].filter(Boolean));
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(pin)) return pin;
  }
  return String(Date.now()).slice(-6).padStart(6, '0');
}

export function findSupervisorByPin(supervisors, pin) {
  const code = String(pin || '').trim();
  if (!validatePinFormat(code)) return null;
  return (supervisors || []).find((s) => s.status === 'Active' && s.loginPin === code) || null;
}

export { validatePinFormat };
