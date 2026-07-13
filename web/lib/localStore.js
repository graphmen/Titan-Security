import {
  generatePremiseId,
  generatePlaceId,
  syncCheckpointFromPlace,
  removeCheckpointForPlace,
} from './premises';
import {
  generateTerritoryId,
  generateSuburbId,
  generateSupervisorId,
} from './territories';
import {
  generateGuardId,
  generateShiftId,
  generateAttendanceId,
  generateSwapId,
  todayDateStr,
  isWithinPremiseGeofence,
  getGuardName,
  getActiveAttendanceForGuard,
  parseShiftMinutes,
  recordGuardMovement,
  evaluateGuardMonitoring,
  evaluateAllOnDutyGuards,
  refreshGuardScores,
  pushGuardAlert,
  dismissGuardAlerts,
  ensureAlertStore,
} from './guards';
import { syncGuardTerritoryFromPremises } from './guardProfile';
import { generateGuardPin, findGuardByPin, validatePinFormat } from './guardAuth';
import {
  queueWhatsApp,
  buildWelcomePinMessage,
  buildPinResetMessage,
  buildShiftMessage,
  buildSupervisorMessage,
  buildWhatsAppWebUrl,
} from './whatsapp';
import {
  DEFAULT_SYSTEM_SETTINGS,
  ensureSystemSettings,
  getGeofenceRadius,
  TITAN_TENANT_ID,
} from './systemSettings';
import { isValidEmailAddress } from './email';

function getPremiseName(state, tenantId, premiseId) {
  const p = (state.premises[tenantId] || []).find((x) => x.id === premiseId);
  return p?.name || premiseId;
}

function issueGuardPin(state, tenantId, guard, { reset = false } = {}) {
  const list = state.guards[tenantId] || [];
  guard.loginPin = generateGuardPin(list.filter((g) => g.id !== guard.id));
  guard.pinMustChange = true;
  guard.pinCreatedAt = new Date().toISOString();
  const body = reset
    ? buildPinResetMessage(guard, guard.loginPin)
    : buildWelcomePinMessage(guard, guard.loginPin);
  return trackWhatsAppEntry(
    state,
    queueWhatsApp(state, tenantId, {
      to: guard.phone,
      guardId: guard.id,
      type: reset ? 'pin_reset' : 'welcome_pin',
      body,
    })
  );
}

function trackWhatsAppEntry(state, entry) {
  if (entry?.id) state._lastWhatsAppEntryId = entry.id;
  return entry;
}

function notifyShiftWhatsApp(state, tenantId, shift) {
  const guard = (state.guards[tenantId] || []).find((g) => g.id === shift.guardId);
  if (!guard?.phone) return null;
  const premiseName = getPremiseName(state, tenantId, shift.premiseId);
  return trackWhatsAppEntry(
    state,
    queueWhatsApp(state, tenantId, {
      to: guard.phone,
      guardId: guard.id,
      type: 'shift_assignment',
      body: buildShiftMessage(guard, shift, premiseName),
      meta: { shiftId: shift.id },
    })
  );
}

export function sanitizeGuardForClient(guard) {
  if (!guard) return null;
  const { loginPin, ...safe } = guard;
  return safe;
}

export function createEmptyAppState() {
  return {
    activeTenantId: TITAN_TENANT_ID,
    systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
    tenants: {
      [TITAN_TENANT_ID]: {
        id: TITAN_TENANT_ID,
        name: 'Titan Protection',
        primaryColor: '#1b4332',
        logoText: 'TP',
        plan: 'Growth Trial',
        status: 'Active',
      },
    },
    territories: { titan: [], alpha: [], omega: [] },
    supervisors: { titan: [], alpha: [], omega: [] },
    premises: { titan: [], alpha: [], omega: [] },
    places: {},
    guards: { titan: [], alpha: [], omega: [] },
    shifts: { titan: [], alpha: [], omega: [] },
    attendance: { titan: [], alpha: [], omega: [] },
    checkpoints: { titan: [], alpha: [], omega: [] },
    guardAlerts: { titan: [], alpha: [], omega: [] },
    shiftSwapRequests: { titan: [], alpha: [], omega: [] },
    whatsappOutbox: { titan: [], alpha: [], omega: [] },
    occurrenceBook: [],
    checklistTemplates: { titan: [], alpha: [], omega: [] },
    checklistSubmissions: [],
    visitors: [],
    activeSosAlerts: {},
  };
}

function ensureStateShape(state) {
  if (!state.tenants || !Object.keys(state.tenants).length) {
    state.tenants = createEmptyAppState().tenants;
  }
  const tenantIds = Object.keys(state.tenants);
  const listKeys = [
    'territories', 'supervisors', 'premises', 'guards', 'shifts', 'attendance',
    'checkpoints', 'guardAlerts', 'shiftSwapRequests', 'whatsappOutbox', 'checklistTemplates',
  ];
  for (const key of listKeys) {
    if (!state[key]) state[key] = {};
    for (const tid of tenantIds) {
      if (!state[key][tid]) state[key][tid] = [];
    }
  }
  if (!state.places) state.places = {};
  if (!state.occurrenceBook) state.occurrenceBook = [];
  if (!state.checklistSubmissions) state.checklistSubmissions = [];
  if (!state.visitors) state.visitors = [];
  if (!state.activeSosAlerts) state.activeSosAlerts = {};
}

/** Demo seed removed — production uses empty state only. */
export function createSeedState() {
  return createEmptyAppState();
}

const globalStore = globalThis;

if (!globalStore.__titanState) {
  globalStore.__titanState = createEmptyAppState();
}

export function getLocalState() {
  const state = globalStore.__titanState;
  ensureStateShape(state);
  Object.values(state.guards || {}).forEach((list) => {
    list.forEach((g) => {
      if (!g.documents) g.documents = [];
      if (!g.trainings) g.trainings = [];
      if (!g.uniformSize) g.uniformSize = '';
      if (!g.city) g.city = '';
      if (!g.suburb) g.suburb = '';
      if (!g.territoryId) g.territoryId = null;
    });
  });
  Object.values(state.premises || {}).forEach((list) => {
    list.forEach((p) => {
      if (!p.suburb) p.suburb = '';
      if (!p.territoryId) p.territoryId = null;
    });
  });
  ensureSystemSettings(state);
  return state;
}

export function getLocalStateWithMonitoring() {
  const state = getLocalState();
  evaluateAllOnDutyGuards(state, state.activeTenantId);
  return state;
}

export function processLocalAction(payload) {
  const state = getLocalState();
  ensureSystemSettings(state);
  const { action } = payload;
  const tenantId = payload.tenantId || TITAN_TENANT_ID;

  const resolveGuard = (guardId, guardName) => {
    if (guardId) return { guardId, guardName: getGuardName(state, tenantId, guardId, guardName) };
    return { guardId: null, guardName: guardName || 'Unknown Guard' };
  };

  switch (action) {
    case 'TAP_NFC': {
      const { checkpointId, guardName: rawName, guardId, lat, lng } = payload;
      const { guardName } = resolveGuard(guardId, rawName);
      const checkpointList = state.checkpoints[tenantId] || [];
      const checkpoint = checkpointList.find((cp) => cp.id === checkpointId);
      if (checkpoint) {
        checkpoint.status = 'Scanned';
        checkpoint.lastScanned = new Date().toISOString();
        if (guardId) {
          const coords = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : checkpoint.coordinates;
          recordGuardMovement(state, tenantId, guardId, coords);
        }
        state.occurrenceBook.unshift({
          id: `ob-nfc-${Date.now()}`,
          tenantId,
          timestamp: new Date().toISOString(),
          guardName,
          type: 'Patrol Tap',
          description: `Check-in at ${checkpoint.premiseName ? checkpoint.premiseName + ' — ' : ''}${checkpoint.name} (${checkpoint.code}). GPS verified.`,
          status: 'Resolved',
          attachments: { photo: null, voice: null },
          premiseId: checkpoint.premiseId || null,
          placeId: checkpoint.placeId || null,
          guardId: guardId || null,
        });
      }
      break;
    }
    case 'LOG_INCIDENT': {
      const { guardName: rawName, guardId, type, description, photo = null, voice = null } = payload;
      const { guardName } = resolveGuard(guardId, rawName);
      state.occurrenceBook.unshift({
        id: `ob-inc-${Date.now()}`,
        tenantId,
        timestamp: new Date().toISOString(),
        guardName,
        type,
        description,
        status: 'Unassigned',
        attachments: { photo, voice },
        guardId: guardId || null,
      });
      break;
    }
    case 'UPDATE_INCIDENT_STATUS': {
      const { incidentId, status } = payload;
      const incident = state.occurrenceBook.find((item) => item.id === incidentId);
      if (incident) incident.status = status;
      break;
    }
    case 'SUBMIT_CHECKLIST': {
      const { templateId, templateName, guardName: rawName, guardId, values } = payload;
      const { guardName } = resolveGuard(guardId, rawName);
      state.checklistSubmissions.unshift({
        id: `sub-${Date.now()}`,
        tenantId,
        templateId,
        templateName,
        timestamp: new Date().toISOString(),
        guardName,
        values,
      });
      state.occurrenceBook.unshift({
        id: `ob-chk-${Date.now()}`,
        tenantId,
        timestamp: new Date().toISOString(),
        guardName,
        type: 'Checklist Submission',
        description: `Completed inspection checklist: "${templateName}" with compliance verification.`,
        status: 'Resolved',
        attachments: { photo: null, voice: null },
      });
      break;
    }
    case 'REGISTER_VISITOR': {
      const { name, idNumber, company, vehiclePlate } = payload;
      state.visitors.unshift({
        id: `v-${Date.now()}`,
        tenantId,
        name,
        idNumber,
        company,
        vehiclePlate: vehiclePlate || 'N/A',
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        status: 'Active',
      });
      break;
    }
    case 'CHECKOUT_VISITOR': {
      const { visitorId } = payload;
      const visitor = state.visitors.find((v) => v.id === visitorId);
      if (visitor) {
        visitor.status = 'Checked Out';
        visitor.checkOutTime = new Date().toISOString();
      }
      break;
    }
    case 'TRIGGER_SOS': {
      const { guardName: rawName, guardId, alertMessage = 'SOS Panic Triggered!' } = payload;
      const { guardName } = resolveGuard(guardId, rawName);
      state.activeSosAlerts[tenantId] = {
        active: true,
        guardName,
        guardId: guardId || null,
        timestamp: new Date().toISOString(),
        message: alertMessage,
      };
      state.occurrenceBook.unshift({
        id: `ob-sos-${Date.now()}`,
        tenantId,
        timestamp: new Date().toISOString(),
        guardName,
        type: 'SOS Panic Alarm',
        description: `EMERGENCY PANIC SIGNAL received from guard device: "${alertMessage}". Dispatching support units.`,
        status: 'Investigating',
        attachments: { photo: null, voice: null },
      });
      break;
    }
    case 'CLEAR_SOS':
      delete state.activeSosAlerts[tenantId];
      break;
    case 'CREATE_TENANT': {
      const { name, primaryColor } = payload;
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (id && !state.tenants[id]) {
        state.tenants[id] = {
          id,
          name,
          primaryColor,
          logoText: name.substring(0, 2).toUpperCase(),
          plan: 'Growth Trial',
          status: 'Active',
        };
        state.checkpoints[id] = [{
          id: `${id}-cp1`,
          name: 'Reception Desk',
          code: `NFC-${id.toUpperCase()}-01`,
          status: 'Pending',
          lastScanned: null,
          coords: { x: 250, y: 250 },
          schedule: 'Every 2 hours',
        }];
        state.checklistTemplates[id] = [];
        state.premises[id] = [];
        state.guards[id] = [];
        state.shifts[id] = [];
        state.attendance[id] = [];
        state.territories[id] = [];
        state.supervisors[id] = [];
        ensureAlertStore(state, id);
      }
      break;
    }
    case 'CREATE_GUARD': {
      const {
        fullName,
        employeeNumber,
        idNumber,
        phone,
        email = '',
        nextOfKinName = '',
        nextOfKinPhone = '',
        nextOfKinRelationship = '',
        licenseNumber = '',
        licenseExpiry = '',
        grade = 'B',
        assignedPremiseIds = [],
        territoryId = null,
        city = '',
        suburb = '',
      } = payload;
      if (!fullName || !idNumber || !phone) {
        return { error: 'Name, ID number and phone are required', status: 400 };
      }
      if (!email?.trim()) {
        return { error: 'Email is required — login PINs are sent by email for the mobile app', status: 400 };
      }
      if (!isValidEmailAddress(email)) {
        return { error: 'Enter a valid email address for the guard', status: 400 };
      }
      if (!state.guards[tenantId]) state.guards[tenantId] = [];
      const newGuard = {
        id: generateGuardId(),
        employeeNumber: employeeNumber || `TP-${String(state.guards[tenantId].length + 1).padStart(3, '0')}`,
        fullName,
        idNumber,
        phone,
        email,
        nextOfKin: { name: nextOfKinName, phone: nextOfKinPhone, relationship: nextOfKinRelationship },
        licenseNumber,
        licenseExpiry,
        grade,
        status: 'Active',
        territoryId: territoryId || null,
        city,
        suburb,
        assignedPremiseIds: Array.isArray(assignedPremiseIds) ? assignedPremiseIds : [],
        photoUrl: null,
        uniformSize: '',
        documents: [],
        trainings: [],
        performanceScore: { composite: 80, punctuality: 80, patrolCompletion: 80, shiftReliability: 80, criticalAlerts: 0 },
        createdAt: new Date().toISOString(),
      };
      issueGuardPin(state, tenantId, newGuard);
      syncGuardTerritoryFromPremises(state, tenantId, newGuard);
      state.guards[tenantId].push(newGuard);
      refreshGuardScores(state, tenantId);
      const waEntry = (state.whatsappOutbox?.[tenantId] || [])[0];
      return {
        success: true,
        generatedPin: newGuard.loginPin,
        guard: { fullName: newGuard.fullName, phone: newGuard.phone, email: newGuard.email },
        guardPhone: newGuard.phone,
        waLink: waEntry?.waLink || buildWhatsAppWebUrl(newGuard.phone, buildWelcomePinMessage(newGuard, newGuard.loginPin)),
        whatsappEntryId: state._lastWhatsAppEntryId || waEntry?.id,
      };
    }
    case 'RESET_GUARD_PIN': {
      const { guardId } = payload;
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (!guard.phone) return { error: 'Guard has no phone number for WhatsApp', status: 400 };
      if (!guard.email?.trim()) return { error: 'Guard has no email — add an email before resetting PIN', status: 400 };
      issueGuardPin(state, tenantId, guard, { reset: true });
      refreshGuardScores(state, tenantId);
      const waEntry = (state.whatsappOutbox?.[tenantId] || [])[0];
      return {
        success: true,
        generatedPin: guard.loginPin,
        guard: { fullName: guard.fullName, phone: guard.phone, email: guard.email },
        guardPhone: guard.phone,
        waLink: waEntry?.waLink || buildWhatsAppWebUrl(guard.phone, buildPinResetMessage(guard, guard.loginPin)),
        whatsappEntryId: state._lastWhatsAppEntryId || waEntry?.id,
      };
    }
    case 'CHANGE_GUARD_PIN': {
      const { guardId, currentPin, newPin } = payload;
      if (!validatePinFormat(newPin)) {
        return { error: 'New PIN must be exactly 6 digits', status: 400 };
      }
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (guard.loginPin !== String(currentPin).trim()) {
        return { error: 'Current PIN is incorrect', status: 403 };
      }
      if (guard.loginPin === String(newPin).trim()) {
        return { error: 'Choose a different PIN', status: 400 };
      }
      guard.loginPin = String(newPin).trim();
      guard.pinMustChange = false;
      guard.pinUpdatedAt = new Date().toISOString();
      break;
    }
    case 'GUARD_LOGIN': {
      const { pin } = payload;
      const guard = findGuardByPin(state.guards[tenantId] || [], pin);
      if (!guard) return { error: 'Invalid PIN — check your email for your login code', status: 401 };
      return {
        success: true,
        guard: sanitizeGuardForClient(guard),
        mustChangePin: !!guard.pinMustChange,
      };
    }
    case 'RESEND_WHATSAPP': {
      const { entryId } = payload;
      const outbox = state.whatsappOutbox?.[tenantId] || [];
      const entry = outbox.find((e) => e.id === entryId);
      if (!entry) return { error: 'Message not found in outbox', status: 404 };
      entry.status = 'queued';
      entry.error = null;
      entry.note = null;
      return { success: true, whatsappEntryId: entry.id };
    }
    case 'SEND_GUARD_WHATSAPP': {
      const { guardId, message, supervisorName = 'Supervisor' } = payload;
      if (!guardId || !message?.trim()) {
        return { error: 'Guard and message are required', status: 400 };
      }
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (!guard.phone) return { error: 'Guard has no phone number', status: 400 };
      const entry = trackWhatsAppEntry(
        state,
        queueWhatsApp(state, tenantId, {
          to: guard.phone,
          guardId: guard.id,
          type: 'supervisor_message',
          body: buildSupervisorMessage(guard, supervisorName, message.trim()),
          meta: { supervisorName },
        })
      );
      refreshGuardScores(state, tenantId);
      return {
        success: true,
        waLink: entry.waLink,
        whatsappEntryId: entry.id,
      };
    }
    case 'UPDATE_GUARD': {
      const { guardId, updates = {} } = payload;
      const list = state.guards[tenantId] || [];
      const guard = list.find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      Object.assign(guard, updates, { updatedAt: new Date().toISOString() });
      if (updates.assignedPremiseIds) syncGuardTerritoryFromPremises(state, tenantId, guard);
      break;
    }
    case 'DELETE_GUARD': {
      const { guardId } = payload;
      const active = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (active) return { error: 'Cannot delete a guard who is currently on duty', status: 409 };
      if (!state.guards[tenantId]) return { error: 'Guard not found', status: 404 };
      const before = state.guards[tenantId].length;
      state.guards[tenantId] = state.guards[tenantId].filter((g) => g.id !== guardId);
      if (state.guards[tenantId].length === before) return { error: 'Guard not found', status: 404 };
      state.guardAlerts[tenantId] = (state.guardAlerts[tenantId] || []).filter((a) => a.guardId !== guardId);
      state.shifts[tenantId] = (state.shifts[tenantId] || []).filter((s) => s.guardId !== guardId);
      state.attendance[tenantId] = (state.attendance[tenantId] || []).filter((a) => a.guardId !== guardId);
      state.shiftSwapRequests[tenantId] = (state.shiftSwapRequests[tenantId] || []).filter(
        (s) => (s.requestingGuardId || s.requesterGuardId) !== guardId && s.targetGuardId !== guardId
      );
      break;
    }
    case 'UPDATE_SHIFT': {
      const { shiftId, updates = {} } = payload;
      const shift = (state.shifts[tenantId] || []).find((s) => s.id === shiftId);
      if (!shift) return { error: 'Shift not found', status: 404 };
      Object.assign(shift, updates, { updatedAt: new Date().toISOString() });
      notifyShiftWhatsApp(state, tenantId, shift);
      break;
    }
    case 'DELETE_SHIFT': {
      const { shiftId } = payload;
      if (!state.shifts[tenantId]) return { error: 'Shift not found', status: 404 };
      const before = state.shifts[tenantId].length;
      state.shifts[tenantId] = state.shifts[tenantId].filter((s) => s.id !== shiftId);
      if (state.shifts[tenantId].length === before) return { error: 'Shift not found', status: 404 };
      break;
    }
    case 'CREATE_SHIFT': {
      const { guardId, premiseId, date, startTime, endTime, shiftType = 'Day' } = payload;
      if (!guardId || !premiseId || !date || !startTime || !endTime) {
        return { error: 'Guard, premises, date and times are required', status: 400 };
      }
      if (!state.shifts[tenantId]) state.shifts[tenantId] = [];
      const newShift = {
        id: generateShiftId(),
        tenantId,
        guardId,
        premiseId,
        date,
        startTime,
        endTime,
        shiftType,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
      };
      state.shifts[tenantId].push(newShift);
      notifyShiftWhatsApp(state, tenantId, newShift);
      break;
    }
    case 'GUARD_CLOCK_IN': {
      const { guardId, premiseId, lat, lng } = payload;
      if (!guardId || !premiseId) return { error: 'Guard and premises required', status: 400 };

      const guards = state.guards[tenantId] || [];
      const guard = guards.find((g) => g.id === guardId);
      if (!guard || guard.status !== 'Active') return { error: 'Guard not active', status: 403 };

      const existing = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (existing) return { error: 'Already clocked in', status: 409 };

      const premiseList = state.premises[tenantId] || [];
      const premise = premiseList.find((p) => p.id === premiseId);
      if (!premise) return { error: 'Premise not found', status: 404 };

      const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      const geofenceRadius = getGeofenceRadius(state);
      if (!isWithinPremiseGeofence(coords, premise.coordinates, geofenceRadius)) {
        return { error: `You must be at the premises to clock in (within ${geofenceRadius}m GPS geofence)`, status: 403 };
      }

      const today = todayDateStr();
      const shifts = (state.shifts[tenantId] || []).filter(
        (s) => s.guardId === guardId && s.premiseId === premiseId && s.date === today
      );
      const shift = shifts[0];
      let lateMinutes = 0;
      let attStatus = 'On Duty';
      if (shift) {
        const now = new Date();
        const scheduledStart = new Date(`${today}T${shift.startTime}:00`);
        lateMinutes = Math.max(0, Math.floor((now - scheduledStart) / 60000));
        if (lateMinutes > 5) attStatus = 'Late';
        shift.status = 'Active';
      }

      const record = {
        id: generateAttendanceId(),
        tenantId,
        guardId,
        premiseId,
        shiftId: shift?.id || null,
        clockIn: new Date().toISOString(),
        clockInCoords: coords,
        clockOut: null,
        clockOutCoords: null,
        status: attStatus,
        lateMinutes,
        lastMovementAt: new Date().toISOString(),
        lastCoords: coords,
        needsMovementAck: false,
        movementTrail: [{ lat: coords.lat, lng: coords.lng, at: new Date().toISOString() }],
      };
      if (!state.attendance[tenantId]) state.attendance[tenantId] = [];
      state.attendance[tenantId].unshift(record);

      state.occurrenceBook.unshift({
        id: `ob-att-in-${Date.now()}`,
        tenantId,
        timestamp: record.clockIn,
        guardName: guard.fullName,
        guardId,
        type: 'Shift Clock-In',
        description: `Clocked in at ${premise.name}${lateMinutes > 5 ? ` (${lateMinutes} min late)` : ''}. GPS verified.`,
        status: 'Resolved',
        attachments: { photo: null, voice: null },
        premiseId,
      });
      break;
    }
    case 'GUARD_CLOCK_OUT': {
      const { guardId, lat, lng } = payload;
      if (!guardId) return { error: 'Guard required', status: 400 };

      const record = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (!record) return { error: 'Not clocked in', status: 404 };

      record.clockOut = new Date().toISOString();
      record.clockOutCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      record.status = 'Clocked Out';

      const shift = (state.shifts[tenantId] || []).find((s) => s.id === record.shiftId);
      if (shift) shift.status = 'Completed';

      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      const premise = (state.premises[tenantId] || []).find((p) => p.id === record.premiseId);

      state.occurrenceBook.unshift({
        id: `ob-att-out-${Date.now()}`,
        tenantId,
        timestamp: record.clockOut,
        guardName: guard?.fullName || 'Guard',
        guardId,
        type: 'Shift Clock-Out',
        description: `Clocked out from ${premise?.name || 'premises'}. Shift ended.`,
        status: 'Resolved',
        attachments: { photo: null, voice: null },
        premiseId: record.premiseId,
      });
      break;
    }
    case 'GUARD_HEARTBEAT': {
      const { guardId, lat, lng } = payload;
      const record = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (record) {
        const coords = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : record.lastCoords;
        const prevCoords = record.lastCoords;
        record.lastCoords = coords;
        if (prevCoords?.lat && coords?.lat) {
          const moved = Math.abs(prevCoords.lat - coords.lat) > 0.00005 || Math.abs(prevCoords.lng - coords.lng) > 0.00005;
          if (moved) recordGuardMovement(state, tenantId, guardId, coords);
        } else if (coords?.lat) {
          record.lastMovementAt = new Date().toISOString();
        }
        evaluateGuardMonitoring(state, tenantId, guardId, coords);
      }
      break;
    }
    case 'GUARD_MOVEMENT_ACK': {
      const { guardId, lat, lng } = payload;
      if (!guardId) return { error: 'Guard required', status: 400 };
      const coords = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
      recordGuardMovement(state, tenantId, guardId, coords);
      const record = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (record) {
        record.movementAckAt = new Date().toISOString();
        record.needsMovementAck = false;
      }
      dismissGuardAlerts(state, tenantId, guardId, 'no_movement');
      break;
    }
    case 'ADD_GUARD_DOCUMENT': {
      const { guardId, type, label, fileName, dataUrl = null } = payload;
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (!guard.documents) guard.documents = [];
      guard.documents.push({
        id: `DOC-${Date.now()}`,
        type: type || 'other',
        label: label || fileName || 'Document',
        fileName: fileName || 'upload.bin',
        dataUrl: dataUrl && dataUrl.length < 500000 ? dataUrl : null,
        uploadedAt: new Date().toISOString(),
      });
      break;
    }
    case 'ADD_GUARD_TRAINING': {
      const { guardId, name, completedDate, expiryDate = '', certificateRef = '' } = payload;
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (!guard.trainings) guard.trainings = [];
      guard.trainings.push({
        id: `TRN-${Date.now()}`,
        name,
        completedDate,
        expiryDate,
        certificateRef,
      });
      break;
    }
    case 'UPDATE_GUARD_PHOTO': {
      const { guardId, photoUrl } = payload;
      const guard = (state.guards[tenantId] || []).find((g) => g.id === guardId);
      if (!guard) return { error: 'Guard not found', status: 404 };
      if (photoUrl && photoUrl.length > 500000) return { error: 'Photo too large (max ~500KB)', status: 400 };
      guard.photoUrl = photoUrl || null;
      break;
    }
    case 'REQUEST_SHIFT_SWAP': {
      const { shiftId, requestingGuardId, targetGuardId, reason = '' } = payload;
      if (!shiftId || !requestingGuardId) return { error: 'Shift and guard required', status: 400 };
      ensureAlertStore(state, tenantId);
      const shift = (state.shifts[tenantId] || []).find((s) => s.id === shiftId);
      if (!shift) return { error: 'Shift not found', status: 404 };
      state.shiftSwapRequests[tenantId].unshift({
        id: generateSwapId(),
        shiftId,
        requestingGuardId,
        targetGuardId: targetGuardId || null,
        reason,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      });
      pushGuardAlert(state, tenantId, {
        type: 'shift_swap',
        severity: 'info',
        guardId: requestingGuardId,
        guardName: getGuardName(state, tenantId, requestingGuardId),
        message: `${getGuardName(state, tenantId, requestingGuardId)} requested a shift swap for ${shift.date} (${shift.startTime}–${shift.endTime}).`,
      });
      break;
    }
    case 'RESOLVE_SHIFT_SWAP': {
      const { swapId, decision } = payload;
      ensureAlertStore(state, tenantId);
      const swap = (state.shiftSwapRequests[tenantId] || []).find((s) => s.id === swapId);
      if (!swap) return { error: 'Swap request not found', status: 404 };
      swap.status = decision === 'approve' ? 'Approved' : 'Rejected';
      swap.resolvedAt = new Date().toISOString();
      if (decision === 'approve' && swap.targetGuardId) {
        const shift = (state.shifts[tenantId] || []).find((s) => s.id === swap.shiftId);
        if (shift) shift.guardId = swap.targetGuardId;
      }
      state.guardAlerts[tenantId].forEach((a) => {
        if (a.type === 'shift_swap' && a.guardId === swap.requestingGuardId && a.status === 'Active') {
          a.status = 'Resolved';
          a.resolvedAt = swap.resolvedAt;
        }
      });
      break;
    }
    case 'DISMISS_GUARD_ALERT': {
      const { alertId } = payload;
      ensureAlertStore(state, tenantId);
      const alert = state.guardAlerts[tenantId].find((a) => a.id === alertId);
      if (alert) {
        alert.status = 'Dismissed';
        alert.resolvedAt = new Date().toISOString();
      }
      break;
    }
    case 'CREATE_PREMISE': {
      const {
        name,
        ownerName,
        ownerContact = '',
        address,
        city = '',
        suburb = '',
        territoryId = null,
        lat,
        lng,
      } = payload;
      if (!name || !address) return { error: 'Premises name and address are required', status: 400 };

      const id = generatePremiseId();
      const premise = {
        id,
        tenantId,
        name,
        ownerName: ownerName || '',
        ownerContact,
        address,
        city,
        suburb,
        territoryId: territoryId || null,
        coordinates: {
          lat: parseFloat(lat) || 0,
          lng: parseFloat(lng) || 0,
        },
        status: 'Active',
        createdAt: new Date().toISOString(),
      };

      if (!state.premises[tenantId]) state.premises[tenantId] = [];
      state.premises[tenantId].push(premise);
      state.places[id] = [];
      break;
    }
    case 'UPDATE_PREMISE': {
      const { premiseId, updates = {} } = payload;
      const premise = (state.premises[tenantId] || []).find((p) => p.id === premiseId);
      if (!premise) return { error: 'Premise not found', status: 404 };
      const { lat, lng, ...rest } = updates;
      Object.assign(premise, rest, { updatedAt: new Date().toISOString() });
      if (lat !== undefined || lng !== undefined) {
        premise.coordinates = {
          lat: parseFloat(lat ?? premise.coordinates?.lat) || 0,
          lng: parseFloat(lng ?? premise.coordinates?.lng) || 0,
        };
      }
      break;
    }
    case 'DELETE_PREMISE': {
      const { premiseId } = payload;
      const premiseList = state.premises[tenantId] || [];
      const premise = premiseList.find((p) => p.id === premiseId);
      if (!premise) return { error: 'Premise not found', status: 404 };
      const places = state.places[premiseId] || [];
      places.forEach((place) => removeCheckpointForPlace(state, tenantId, place.id));
      delete state.places[premiseId];
      state.premises[tenantId] = premiseList.filter((p) => p.id !== premiseId);
      (state.guards[tenantId] || []).forEach((g) => {
        if (g.assignedPremiseIds?.includes(premiseId)) {
          g.assignedPremiseIds = g.assignedPremiseIds.filter((id) => id !== premiseId);
        }
      });
      break;
    }
    case 'CREATE_PLACE': {
      const {
        premiseId,
        name,
        type = 'other',
        description = '',
        lat,
        lng,
        hasNfc = false,
        nfcCode = '',
        schedule = 'Every 2 hours',
      } = payload;

      if (!premiseId || !name) return { error: 'Premise and place name are required', status: 400 };

      const premiseList = state.premises[tenantId] || [];
      const premise = premiseList.find((p) => p.id === premiseId);
      if (!premise) return { error: 'Premise not found', status: 404 };

      const place = {
        id: generatePlaceId(),
        premiseId,
        tenantId,
        name,
        type,
        description,
        coordinates: {
          lat: parseFloat(lat) || premise.coordinates.lat,
          lng: parseFloat(lng) || premise.coordinates.lng,
        },
        hasNfc: !!hasNfc,
        nfcCode: hasNfc ? (nfcCode || `NFC-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`) : '',
        schedule,
        createdAt: new Date().toISOString(),
      };

      if (!state.places[premiseId]) state.places[premiseId] = [];
      state.places[premiseId].push(place);
      syncCheckpointFromPlace(state, tenantId, premise, place);
      break;
    }
    case 'UPDATE_PLACE': {
      const {
        premiseId,
        placeId,
        name,
        type,
        description,
        lat,
        lng,
        hasNfc,
        nfcCode,
        schedule,
      } = payload;
      const premiseList = state.premises[tenantId] || [];
      const premise = premiseList.find((p) => p.id === premiseId);
      if (!premise) return { error: 'Premise not found', status: 404 };
      const placeList = state.places[premiseId] || [];
      const place = placeList.find((p) => p.id === placeId);
      if (!place) return { error: 'Place not found', status: 404 };
      if (name !== undefined) place.name = name;
      if (type !== undefined) place.type = type;
      if (description !== undefined) place.description = description;
      if (hasNfc !== undefined) place.hasNfc = !!hasNfc;
      if (nfcCode !== undefined) place.nfcCode = nfcCode;
      if (schedule !== undefined) place.schedule = schedule;
      if (lat !== undefined || lng !== undefined) {
        place.coordinates = {
          lat: parseFloat(lat ?? place.coordinates?.lat) || premise.coordinates.lat,
          lng: parseFloat(lng ?? place.coordinates?.lng) || premise.coordinates.lng,
        };
      }
      place.updatedAt = new Date().toISOString();
      removeCheckpointForPlace(state, tenantId, placeId);
      if (place.hasNfc) syncCheckpointFromPlace(state, tenantId, premise, place);
      break;
    }
    case 'DELETE_PLACE': {
      const { premiseId, placeId } = payload;
      if (state.places[premiseId]) {
        state.places[premiseId] = state.places[premiseId].filter((p) => p.id !== placeId);
      }
      removeCheckpointForPlace(state, tenantId, placeId);
      break;
    }
    case 'CREATE_TERRITORY': {
      const { name, city, suburbs = [], description = '' } = payload;
      if (!name || !city) return { error: 'Territory name and city are required', status: 400 };
      if (!state.territories[tenantId]) state.territories[tenantId] = [];
      const suburbList = (Array.isArray(suburbs) ? suburbs : [])
        .filter((s) => (typeof s === 'string' ? s.trim() : s?.name?.trim()))
        .map((s) => (typeof s === 'string'
          ? { id: generateSuburbId(), name: s.trim() }
          : { id: s.id || generateSuburbId(), name: s.name.trim() }));
      state.territories[tenantId].push({
        id: generateTerritoryId(),
        tenantId,
        name,
        city,
        suburbs: suburbList,
        description,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
      break;
    }
    case 'UPDATE_TERRITORY': {
      const { territoryId, updates = {} } = payload;
      const territory = (state.territories[tenantId] || []).find((t) => t.id === territoryId);
      if (!territory) return { error: 'Territory not found', status: 404 };
      const { suburbs, ...rest } = updates;
      Object.assign(territory, rest, { updatedAt: new Date().toISOString() });
      if (suburbs !== undefined && Array.isArray(suburbs)) {
        territory.suburbs = suburbs.map((s) => (typeof s === 'string'
          ? { id: generateSuburbId(), name: s.trim() }
          : { id: s.id || generateSuburbId(), name: s.name.trim() }));
      }
      break;
    }
    case 'DELETE_TERRITORY': {
      const { territoryId } = payload;
      const guardsUsing = (state.guards[tenantId] || []).filter((g) => g.territoryId === territoryId);
      const premisesUsing = (state.premises[tenantId] || []).filter((p) => p.territoryId === territoryId);
      if (guardsUsing.length || premisesUsing.length) {
        return { error: 'Territory is assigned to guards or premises. Reassign them first.', status: 409 };
      }
      if (!state.territories[tenantId]) return { error: 'Territory not found', status: 404 };
      const before = state.territories[tenantId].length;
      state.territories[tenantId] = state.territories[tenantId].filter((t) => t.id !== territoryId);
      if (state.territories[tenantId].length === before) return { error: 'Territory not found', status: 404 };
      (state.supervisors[tenantId] || []).forEach((s) => {
        s.assignedTerritoryIds = (s.assignedTerritoryIds || []).filter((id) => id !== territoryId);
      });
      break;
    }
    case 'CREATE_SUPERVISOR': {
      const {
        fullName,
        employeeNumber,
        phone,
        email = '',
        role = 'Area Supervisor',
        assignedTerritoryIds = [],
      } = payload;
      if (!fullName || !phone) return { error: 'Name and phone are required', status: 400 };
      if (!state.supervisors[tenantId]) state.supervisors[tenantId] = [];
      state.supervisors[tenantId].push({
        id: generateSupervisorId(),
        employeeNumber: employeeNumber || `TS-${String(state.supervisors[tenantId].length + 1).padStart(3, '0')}`,
        fullName,
        phone,
        email,
        role,
        assignedTerritoryIds: Array.isArray(assignedTerritoryIds) ? assignedTerritoryIds : [],
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
      break;
    }
    case 'UPDATE_SUPERVISOR': {
      const { supervisorId, updates = {} } = payload;
      const supervisor = (state.supervisors[tenantId] || []).find((s) => s.id === supervisorId);
      if (!supervisor) return { error: 'Supervisor not found', status: 404 };
      Object.assign(supervisor, updates, { updatedAt: new Date().toISOString() });
      break;
    }
    case 'DELETE_SUPERVISOR': {
      const { supervisorId } = payload;
      if (!state.supervisors[tenantId]) return { error: 'Supervisor not found', status: 404 };
      const before = state.supervisors[tenantId].length;
      state.supervisors[tenantId] = state.supervisors[tenantId].filter((s) => s.id !== supervisorId);
      if (state.supervisors[tenantId].length === before) return { error: 'Supervisor not found', status: 404 };
      break;
    }
    case 'SWITCH_TENANT': {
      state.activeTenantId = TITAN_TENANT_ID;
      break;
    }
    case 'CLEAR_TENANT_DEMO_DATA': {
      const empty = createEmptyAppState();
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, empty);
      break;
    }
    case 'UPDATE_SYSTEM_SETTINGS': {
      const { updates } = payload;
      if (!updates || typeof updates !== 'object') {
        return { error: 'Settings updates required', status: 400 };
      }
      ensureSystemSettings(state);
      const allowed = [
        'sirenAlertsEnabled',
        'geofenceRadiusMeters',
        'noMovementAlertMinutes',
        'licenseExpiryWarningDays',
      ];
      allowed.forEach((key) => {
        if (updates[key] !== undefined) {
          state.systemSettings[key] = updates[key];
        }
      });
      state.systemSettings.updatedAt = new Date().toISOString();
      break;
    }
    case 'CREATE_CHECKLIST_TEMPLATE': {
      const { name, description, fields } = payload;
      if (!state.checklistTemplates[tenantId]) {
        state.checklistTemplates[tenantId] = [];
      }
      state.checklistTemplates[tenantId].push({
        id: `temp-${Date.now()}`,
        name,
        description,
        fields,
      });
      break;
    }
    case 'RESET_STATE': {
      (state.checkpoints[tenantId] || []).forEach((cp) => {
        cp.status = 'Pending';
        cp.lastScanned = null;
      });
      delete state.activeSosAlerts[tenantId];
      break;
    }
    default:
      return { error: 'Unknown Action type', status: 400 };
  }

  refreshGuardScores(state, tenantId);
  const whatsappEntryId = state._lastWhatsAppEntryId;
  delete state._lastWhatsAppEntryId;
  const out = { success: true };
  if (whatsappEntryId) out.whatsappEntryId = whatsappEntryId;
  return out;
}
