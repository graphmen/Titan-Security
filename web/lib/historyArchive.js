/** Operational records older than this move to history (ms). */
export const DEFAULT_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;

export function getArchiveCutoffMs(state) {
  const hours = Number(state?.systemSettings?.obArchiveAfterHours);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return Date.now() - h * 60 * 60 * 1000;
}

function isOpenIncident(item) {
  return (
    item.type &&
    !['Patrol Tap', 'Shift Clock-In', 'Shift Clock-Out'].includes(item.type) &&
    item.status &&
    item.status !== 'Resolved'
  );
}

/** Live OB feed — last 24h; open incidents stay visible until resolved. */
export function getLiveOccurrenceBook(state, tenantId) {
  const cutoff = getArchiveCutoffMs(state);
  return (state?.occurrenceBook || []).filter((item) => {
    if (item.tenantId && item.tenantId !== tenantId) return false;
    if (isOpenIncident(item)) return true;
    const ts = new Date(item.timestamp).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

/** History book — entries older than 24h (still stored in DB). */
export function getOccurrenceHistory(state, tenantId) {
  const cutoff = getArchiveCutoffMs(state);
  return (state?.occurrenceBook || []).filter((item) => {
    if (item.tenantId && item.tenantId !== tenantId) return false;
    const ts = new Date(item.timestamp).getTime();
    return Number.isFinite(ts) && ts < cutoff;
  });
}

/** Today's visitor register — check-ins from last 24h. */
export function getLiveVisitors(state, tenantId) {
  const cutoff = getArchiveCutoffMs(state);
  return (state?.visitors || []).filter((v) => {
    if (v.tenantId && v.tenantId !== tenantId) return false;
    const ts = new Date(v.checkInTime).getTime();
    return !Number.isFinite(ts) || ts >= cutoff || v.status === 'Active';
  });
}

export function getVisitorHistory(state, tenantId) {
  const cutoff = getArchiveCutoffMs(state);
  return (state?.visitors || []).filter((v) => {
    if (v.tenantId && v.tenantId !== tenantId) return false;
    const ts = new Date(v.checkInTime).getTime();
    return Number.isFinite(ts) && ts < cutoff && v.status !== 'Active';
  });
}

export function formatObDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Legacy — no destructive archive; filtering is done at read time. */
export function archiveStaleOperationalRecords(state, tenantId) {
  return { obArchived: 0, visitorsArchived: 0 };
}
