/** Coerce unknown API values to arrays — prevents .filter/.map crashes in the dashboard. */
export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Tenant-keyed collections (premises, guards, …) must always hold arrays per tenant. */
export function normalizeTenantCollections(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
  const out = {};
  for (const [tenantId, rows] of Object.entries(map)) {
    out[tenantId] = asArray(rows);
  }
  return out;
}

/** Rows for one tenant from a tenant-keyed collection. */
export function tenantRows(map, tenantId) {
  return asArray(map?.[tenantId]);
}
