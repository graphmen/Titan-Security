const SENSITIVE_KEYS = new Set([
  'loginpin',
  'login_pin',
  'pin',
  'password',
  'authsecret',
  'dataurl',
  'photo',
  'voice',
  'attachments',
]);

const PREFERRED_COLUMNS = [
  'id',
  'name',
  'fullName',
  'guardName',
  'premiseId',
  'guardId',
  'territoryId',
  'status',
  'type',
  'timestamp',
  'createdAt',
  'clockIn',
  'phone',
  'email',
  'address',
  'severity',
  'date',
];

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase());
}

function truncateValue(value, max = 80) {
  if (value == null) return '';
  if (typeof value === 'object') {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function sanitizeRecord(raw, depth = 0) {
  if (raw == null || depth > 8) return raw;
  if (Array.isArray(raw)) {
    return raw.map((item) => sanitizeRecord(item, depth + 1));
  }
  if (typeof raw !== 'object') return raw;

  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isSensitiveKey(key)) {
      if (key.toLowerCase() === 'dataurl' || key.toLowerCase() === 'photo') {
        out[key] = value ? '[redacted — binary/media]' : value;
      } else {
        out[key] = value ? '[redacted]' : value;
      }
      continue;
    }
    if (typeof value === 'string' && value.startsWith('data:') && value.length > 120) {
      out[key] = '[redacted — data URL]';
      continue;
    }
    out[key] = sanitizeRecord(value, depth + 1);
  }
  return out;
}

export function inferColumns(rows, maxCols = 6) {
  if (!rows?.length) return ['id'];
  const keys = new Set();
  rows.slice(0, 20).forEach((row) => {
    Object.keys(row || {}).forEach((k) => keys.add(k));
  });
  const ordered = PREFERRED_COLUMNS.filter((k) => keys.has(k));
  keys.forEach((k) => {
    if (!ordered.includes(k)) ordered.push(k);
  });
  return ordered.slice(0, maxCols);
}

export function filterRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(q)
  );
}

function flattenPlaces(places = {}) {
  const rows = [];
  for (const [premiseId, list] of Object.entries(places)) {
    (list || []).forEach((place) => {
      rows.push({ ...place, premiseId });
    });
  }
  return rows;
}

function flattenGuardDocuments(guards = []) {
  const rows = [];
  guards.forEach((g) => {
    (g.documents || []).forEach((doc, idx) => {
      rows.push({
        guardId: g.id,
        guardName: g.fullName,
        docIndex: idx,
        ...doc,
      });
    });
  });
  return rows;
}

function flattenTerritorySuburbs(territories = []) {
  const rows = [];
  territories.forEach((t) => {
    (t.suburbs || []).forEach((s) => {
      rows.push({
        territoryId: t.id,
        territoryName: t.name,
        suburbId: s.id,
        suburbName: s.name,
      });
    });
  });
  return rows;
}

/**
 * Build explorer catalog from dashboard state for one tenant.
 */
export function buildExplorerCatalog(state, tenantId) {
  if (!state) return { tables: [], totalRows: 0 };

  const tid = tenantId || state.activeTenantId || 'titan';
  const tables = [];

  const add = (id, label, category, supabaseTable, rows, description = '') => {
    const sanitized = (rows || []).map((r) => sanitizeRecord(r));
    tables.push({
      id,
      label,
      category,
      supabaseTable,
      description,
      rows: sanitized,
      count: sanitized.length,
      columns: inferColumns(sanitized),
    });
  };

  add(
    'tenants',
    'Tenants',
    'Core',
    'tenants',
    Object.values(state.tenants || {}),
    'Organisations using the platform.'
  );

  add(
    'system_settings',
    'System settings',
    'Core',
    'system_settings',
    state.systemSettings ? [{ ...state.systemSettings, tenantId: tid }] : [],
    'Geofence, alerts, and company configuration.'
  );

  add(
    'territories',
    'Territories',
    'Geography',
    'territories',
    state.territories?.[tid] || [],
    'Operational areas (city / suburbs).'
  );

  add(
    'territory_suburbs',
    'Territory suburbs',
    'Geography',
    'territory_suburbs',
    flattenTerritorySuburbs(state.territories?.[tid] || []),
    'Suburbs linked to each territory.'
  );

  add(
    'premises',
    'Premises',
    'Geography',
    'premises',
    state.premises?.[tid] || [],
    'Protected sites with GPS coordinates.'
  );

  add(
    'places',
    'Patrol places',
    'Geography',
    'places',
    flattenPlaces(state.places),
    'Checkpoints and important areas within premises.'
  );

  add(
    'supervisors',
    'Supervisors',
    'People',
    'supervisors',
    state.supervisors?.[tid] || [],
    'Area supervisors and territory assignments.'
  );

  add(
    'guards',
    'Guards',
    'People',
    'guards',
    (state.guards?.[tid] || []).map((g) => sanitizeRecord(g)),
    'Field guards — PINs redacted in this view.'
  );

  add(
    'guard_documents',
    'Guard documents',
    'People',
    'guards.documents',
    flattenGuardDocuments(state.guards?.[tid] || []),
    'Uploaded files and training records (media redacted).'
  );

  add(
    'shifts',
    'Shifts',
    'Operations',
    'shifts',
    state.shifts?.[tid] || [],
    'Scheduled guard shifts.'
  );

  add(
    'attendance',
    'Attendance',
    'Operations',
    'attendance',
    state.attendance?.[tid] || [],
    'Clock-in/out records and live GPS trails.'
  );

  add(
    'checkpoints',
    'NFC checkpoints',
    'Operations',
    'checkpoints',
    state.checkpoints?.[tid] || [],
    'Patrol NFC scan points synced from places.'
  );

  add(
    'guard_alerts',
    'Guard alerts',
    'Operations',
    'guard_alerts',
    state.guardAlerts?.[tid] || [],
    'Geofence, movement, and license alerts.'
  );

  add(
    'shift_swaps',
    'Shift swap requests',
    'Operations',
    'shift_swap_requests',
    state.shiftSwapRequests?.[tid] || [],
    'Pending guard shift swap requests.'
  );

  add(
    'occurrence_book',
    'Occurrence book',
    'Communications',
    'occurrence_book',
    (state.occurrenceBook || []).filter((ob) => ob.tenantId === tid),
    'Patrol taps, incidents, clock events, SOS log.'
  );

  add(
    'whatsapp_outbox',
    'WhatsApp outbox',
    'Communications',
    'whatsapp_outbox',
    state.whatsappOutbox?.[tid] || [],
    'Queued WhatsApp PIN and shift messages.'
  );

  add(
    'checklist_templates',
    'Checklist templates',
    'Compliance',
    'checklist_templates',
    state.checklistTemplates?.[tid] || [],
    'Custom inspection checklist definitions.'
  );

  add(
    'checklist_submissions',
    'Checklist submissions',
    'Compliance',
    'checklist_submissions',
    (state.checklistSubmissions || []).filter((s) => s.tenantId === tid),
    'Completed guard inspection submissions.'
  );

  add(
    'visitors',
    'Visitors',
    'Compliance',
    'visitors',
    (state.visitors || []).filter((v) => v.tenantId === tid),
    'Guest sign-in / sign-out register.'
  );

  const sos = state.activeSosAlerts?.[tid];
  add(
    'active_sos',
    'Active SOS',
    'Emergency',
    'active_sos_alerts',
    sos?.active ? [{ ...sos, tenantId: tid }] : [],
    'Live panic alarm if one is active.'
  );

  const totalRows = tables.reduce((n, t) => n + t.count, 0);
  return { tables, totalRows, tenantId: tid };
}

export function groupTablesByCategory(tables) {
  const groups = {};
  tables.forEach((t) => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });
  return groups;
}

export function formatCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    return truncateValue(value, 64);
  }
  return truncateValue(value, 64);
}

export { truncateValue };
