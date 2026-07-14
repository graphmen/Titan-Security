export function premiseName(premises, id) {
  return premises.find((p) => p.id === id)?.name || 'Site';
}

export function guardName(guards, id) {
  return guards.find((g) => g.id === id)?.fullName || 'Guard';
}

export function scoreColor(score) {
  if (score >= 80) return 'var(--mob-success)';
  if (score >= 60) return 'var(--mob-warning)';
  return 'var(--mob-danger)';
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
