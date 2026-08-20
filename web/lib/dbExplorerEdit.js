/** Maps explorer table ids to /api/state update actions. */
export const TABLE_EDIT_CONFIG = {
  premises: {
    idKey: 'id',
    editableFields: ['name', 'ownerName', 'ownerContact', 'address', 'city', 'suburb', 'status', 'territoryId'],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_PREMISE', tenantId, premiseId: row.id, updates };
    },
  },
  places: {
    idKey: 'id',
    editableFields: ['name', 'type', 'description', 'schedule', 'nfcCode', 'hasNfc'],
    buildPayload(row, updates, tenantId) {
      return {
        action: 'UPDATE_PLACE',
        tenantId,
        premiseId: row.premiseId,
        placeId: row.id,
        ...updates,
      };
    },
  },
  guards: {
    idKey: 'id',
    editableFields: ['fullName', 'phone', 'email', 'status', 'employeeNumber', 'territoryId', 'licenseExpiry'],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_GUARD', tenantId, guardId: row.id, updates };
    },
  },
  supervisors: {
    idKey: 'id',
    editableFields: ['fullName', 'phone', 'email', 'role', 'status', 'employeeNumber'],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_SUPERVISOR', tenantId, supervisorId: row.id, updates };
    },
  },
  territories: {
    idKey: 'id',
    editableFields: ['name', 'city', 'description', 'status'],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_TERRITORY', tenantId, territoryId: row.id, updates };
    },
  },
  shifts: {
    idKey: 'id',
    editableFields: ['date', 'startTime', 'endTime', 'shiftType', 'status', 'guardId', 'premiseId'],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_SHIFT', tenantId, shiftId: row.id, updates };
    },
  },
  guard_alerts: {
    idKey: 'id',
    editableFields: ['status'],
    buildPayload(row, updates, tenantId) {
      if (updates.status === 'Dismissed') {
        return { action: 'DISMISS_GUARD_ALERT', tenantId, alertId: row.id };
      }
      return null;
    },
  },
  occurrence_book: {
    idKey: 'id',
    editableFields: ['status'],
    buildPayload(row, updates, tenantId) {
      if (updates.status == null) return null;
      return { action: 'UPDATE_INCIDENT_STATUS', tenantId, incidentId: row.id, status: updates.status };
    },
  },
  system_settings: {
    idKey: null,
    editableFields: [
      'companyName',
      'companyShortName',
      'sirenAlertsEnabled',
      'geofenceRadiusMeters',
      'noMovementAlertMinutes',
      'licenseExpiryWarningDays',
    ],
    buildPayload(row, updates, tenantId) {
      return { action: 'UPDATE_SYSTEM_SETTINGS', tenantId, updates };
    },
  },
};

const BLOCKED_EDIT_FIELDS = new Set([
  'loginpin',
  'login_pin',
  'pin',
  'password',
  'documents',
  'movementtrail',
  'clockincoords',
  'clockoutcoords',
  'lastcoords',
  'coordinates',
  'attachments',
  'values',
  'fields',
  'suburbs',
]);

export function isTableEditable(tableId) {
  return Boolean(TABLE_EDIT_CONFIG[tableId]);
}

export function isFieldEditable(tableId, field) {
  const cfg = TABLE_EDIT_CONFIG[tableId];
  if (!cfg) return false;
  if (BLOCKED_EDIT_FIELDS.has(String(field).toLowerCase())) return false;
  return cfg.editableFields.includes(field);
}

export function getEditableFields(tableId) {
  return TABLE_EDIT_CONFIG[tableId]?.editableFields || [];
}

export function parseEditValue(raw, current) {
  if (raw === '—' || raw === '') return null;
  if (typeof current === 'boolean') {
    return raw === 'Yes' || raw === 'true' || raw === '1';
  }
  if (typeof current === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : current;
  }
  return raw;
}

export function buildCellUpdate(tableId, row, field, newValue, tenantId) {
  const cfg = TABLE_EDIT_CONFIG[tableId];
  if (!cfg || !isFieldEditable(tableId, field)) {
    return { error: 'This field cannot be edited here' };
  }
  const updates = { [field]: parseEditValue(newValue, row[field]) };
  const payload = cfg.buildPayload(row, updates, tenantId || row.tenantId);
  if (!payload) return { error: 'Update not supported for this value' };
  return { payload, updates };
}

export function buildRowJsonUpdate(tableId, row, parsedRow, tenantId) {
  const cfg = TABLE_EDIT_CONFIG[tableId];
  if (!cfg) return { error: 'This collection is read-only' };

  const updates = {};
  cfg.editableFields.forEach((field) => {
    if (parsedRow[field] !== undefined && parsedRow[field] !== row[field]) {
      if (typeof parsedRow[field] === 'object' && parsedRow[field] !== null) return;
      updates[field] = parsedRow[field];
    }
  });

  if (!Object.keys(updates).length) {
    return { error: 'No editable fields changed' };
  }

  const payload = cfg.buildPayload(row, updates, tenantId);
  if (!payload) return { error: 'Could not build save request' };
  return { payload, updates };
}
