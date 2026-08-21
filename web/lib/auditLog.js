export function ensureAuditLog(state) {
  if (!Array.isArray(state.auditLog)) state.auditLog = [];
  return state.auditLog;
}

export function appendAuditLog(state, entry) {
  const log = ensureAuditLog(state);
  log.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (log.length > 500) log.length = 500;
  return log[0];
}

export function getAuditLog(state, tenantId, limit = 50) {
  return ensureAuditLog(state)
    .filter((e) => !tenantId || e.tenantId === tenantId)
    .slice(0, limit);
}
