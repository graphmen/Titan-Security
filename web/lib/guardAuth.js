/** Generate a unique 6-digit login PIN for a guard. */
export function generateGuardPin(guards = []) {
  const used = new Set((guards || []).map((g) => g.loginPin).filter(Boolean));
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(pin)) return pin;
  }
  return String(Date.now()).slice(-6).padStart(6, '0');
}

/** Find active guard by 6-digit PIN within a tenant. */
export function findGuardByPin(guards, pin) {
  const code = String(pin || '').trim();
  if (!/^\d{6}$/.test(code)) return null;
  return (guards || []).find((g) => g.status === 'Active' && g.loginPin === code) || null;
}

export function validatePinFormat(pin) {
  return /^\d{6}$/.test(String(pin || '').trim());
}
