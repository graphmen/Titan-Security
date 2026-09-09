export function resolveVisitorPremiseName(state, tenantId, visitor) {
  if (visitor?.premiseName) return visitor.premiseName;
  if (!visitor?.premiseId) return '—';
  const premise = (state?.premises?.[tenantId] || []).find((p) => p.id === visitor.premiseId);
  return premise?.name || visitor.premiseId;
}

export function formatVisitorCheckInTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
