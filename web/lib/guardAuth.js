/** Generate a unique 6-digit login PIN for a guard. */
export function generateGuardPin(guards = []) {
  const used = new Set((guards || []).map((g) => normalizeLoginPin(g.loginPin)).filter(Boolean));
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(pin)) return pin;
  }
  return String(Date.now()).slice(-6).padStart(6, '0');
}

export function normalizeLoginPin(pin) {
  const code = String(pin ?? '').trim();
  return /^\d{6}$/.test(code) ? code : null;
}

export function isActivePersonStatus(status) {
  return String(status || '').toLowerCase() === 'active';
}

/** Find active guard by 6-digit PIN within a tenant. */
export function findGuardByPin(guards, pin) {
  const code = normalizeLoginPin(pin);
  if (!code) return null;
  return (guards || []).find(
    (g) => isActivePersonStatus(g.status) && normalizeLoginPin(g.loginPin) === code
  ) || null;
}

export function validatePinFormat(pin) {
  return normalizeLoginPin(pin) != null;
}
