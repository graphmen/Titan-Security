/**
 * Direct DB writes for guard mobile field actions (incidents, SOS, clock-in, etc.).
 * Full-state sync (saveAppStateToRelationalDb) does not include occurrence_book / SOS tables.
 */
import { supabaseAdmin } from '../../app/supabase';
import { getActiveAttendanceForGuard } from '../guards.js';

export const OPERATIONAL_WRITE_ACTIONS = new Set([
  'LOG_INCIDENT',
  'TRIGGER_SOS',
  'CLEAR_SOS',
  'GUARD_CLOCK_IN',
  'GUARD_CLOCK_OUT',
  'GUARD_HEARTBEAT',
  'GUARD_MOVEMENT_ACK',
  'TAP_NFC',
  'REQUEST_SHIFT_SWAP',
  'SUBMIT_CHECKLIST',
  'REGISTER_VISITOR',
  'CHECKOUT_VISITOR',
  'UPDATE_INCIDENT_STATUS',
]);

const db = supabaseAdmin;

async function requireDbOk(result, context) {
  if (result?.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result;
}

import {
  attendanceToRow,
  alertToRow,
  checkpointToRow,
  occurrenceToRow,
  shiftToRow,
  swapToRow,
} from './mappers.js';

export function usesOperationalDbWrite(action) {
  return OPERATIONAL_WRITE_ACTIONS.has(action);
}

function latestOccurrence(state) {
  return (state.occurrenceBook || [])[0] || null;
}

function findOccurrenceByPrefix(state, prefix) {
  return (state.occurrenceBook || []).find((item) => item.id?.startsWith(prefix)) || null;
}

export async function persistOperationalActionToDb(action, payload, tenantId, state) {
  switch (action) {
    case 'LOG_INCIDENT': {
      const item = latestOccurrence(state);
      if (!item) throw new Error('Incident not found in memory after save');
      await requireDbOk(
        await db.from('occurrence_book').upsert(occurrenceToRow(item, tenantId)),
        'occurrence_book LOG_INCIDENT'
      );
      break;
    }
    case 'UPDATE_INCIDENT_STATUS': {
      const { incidentId, status } = payload;
      await requireDbOk(
        await db.from('occurrence_book').update({ status }).eq('id', incidentId),
        'occurrence_book UPDATE_INCIDENT_STATUS'
      );
      break;
    }
    case 'TRIGGER_SOS': {
      const alert = state.activeSosAlerts?.[tenantId];
      const item = findOccurrenceByPrefix(state, 'ob-sos-');
      if (alert) {
        await requireDbOk(
          await db.from('active_sos_alerts').upsert({
            tenant_id: tenantId,
            guard_name: alert.guardName,
            timestamp: alert.timestamp || new Date().toISOString(),
            message: alert.message,
          }),
          'active_sos_alerts TRIGGER_SOS'
        );
      }
      if (item) {
        await requireDbOk(
          await db.from('occurrence_book').upsert(occurrenceToRow(item, tenantId)),
          'occurrence_book SOS'
        );
      }
      break;
    }
    case 'CLEAR_SOS':
      await requireDbOk(
        await db.from('active_sos_alerts').delete().eq('tenant_id', tenantId),
        'active_sos_alerts CLEAR_SOS'
      );
      break;
    case 'GUARD_CLOCK_IN':
    case 'GUARD_CLOCK_OUT': {
      const { guardId } = payload;
      const record =
        action === 'GUARD_CLOCK_OUT'
          ? (state.attendance?.[tenantId] || []).find((a) => a.guardId === guardId)
          : getActiveAttendanceForGuard(state, tenantId, guardId);
      if (record) {
        await requireDbOk(
          await db.from('guard_attendance').upsert(attendanceToRow(record, tenantId)),
          'guard_attendance clock'
        );
      }
      const shift = (state.shifts?.[tenantId] || []).find(
        (s) => s.id === record?.shiftId || (s.guardId === guardId && s.date === new Date().toISOString().slice(0, 10))
      );
      if (shift) {
        await requireDbOk(
          await db.from('shifts').upsert(shiftToRow(shift, tenantId)),
          'shifts clock status'
        );
      }
      const obPrefix = action === 'GUARD_CLOCK_IN' ? 'ob-att-in-' : 'ob-att-out-';
      const item = findOccurrenceByPrefix(state, obPrefix);
      if (item) {
        await requireDbOk(
          await db.from('occurrence_book').upsert(occurrenceToRow(item, tenantId)),
          'occurrence_book clock'
        );
      }
      break;
    }
    case 'GUARD_HEARTBEAT':
    case 'GUARD_MOVEMENT_ACK': {
      const { guardId } = payload;
      const record = getActiveAttendanceForGuard(state, tenantId, guardId);
      if (record) {
        await requireDbOk(
          await db.from('guard_attendance').upsert(attendanceToRow(record, tenantId)),
          'guard_attendance heartbeat'
        );
      }
      const alerts = (state.guardAlerts?.[tenantId] || []).filter((a) => a.guardId === guardId);
      if (alerts.length) {
        await requireDbOk(
          await db.from('guard_alerts').upsert(alerts.map((a) => alertToRow(a, tenantId))),
          'guard_alerts movement'
        );
      }
      break;
    }
    case 'TAP_NFC': {
      const { checkpointId } = payload;
      const cp = (state.checkpoints?.[tenantId] || []).find((c) => c.id === checkpointId);
      if (cp) {
        await requireDbOk(
          await db.from('checkpoints').upsert(checkpointToRow(cp, tenantId)),
          'checkpoints TAP_NFC'
        );
      }
      const item = findOccurrenceByPrefix(state, 'ob-nfc-') || latestOccurrence(state);
      if (item) {
        await requireDbOk(
          await db.from('occurrence_book').upsert(occurrenceToRow(item, tenantId)),
          'occurrence_book TAP_NFC'
        );
      }
      break;
    }
    case 'REQUEST_SHIFT_SWAP': {
      const swap = (state.shiftSwapRequests?.[tenantId] || [])[0];
      if (swap) {
        await requireDbOk(
          await db.from('shift_swap_requests').upsert(swapToRow(swap, tenantId)),
          'shift_swap_requests'
        );
      }
      const alert = (state.guardAlerts?.[tenantId] || []).find(
        (a) => a.type === 'shift_swap' && a.status === 'Active'
      );
      if (alert) {
        await requireDbOk(
          await db.from('guard_alerts').upsert(alertToRow(alert, tenantId)),
          'guard_alerts shift_swap'
        );
      }
      break;
    }
    case 'SUBMIT_CHECKLIST': {
      const sub = (state.checklistSubmissions || [])[0];
      if (sub) {
        await requireDbOk(
          await db.from('checklist_submissions').upsert({
            id: sub.id,
            tenant_id: tenantId,
            template_id: sub.templateId,
            template_name: sub.templateName,
            guard_name: sub.guardName,
            values: sub.values,
            timestamp: sub.timestamp || new Date().toISOString(),
          }),
          'checklist_submissions'
        );
      }
      const item = findOccurrenceByPrefix(state, 'ob-chk-');
      if (item) {
        await requireDbOk(
          await db.from('occurrence_book').upsert(occurrenceToRow(item, tenantId)),
          'occurrence_book checklist'
        );
      }
      break;
    }
    case 'REGISTER_VISITOR': {
      const visitor = (state.visitors || [])[0];
      if (visitor) {
        await requireDbOk(
          await db.from('visitors').upsert({
            id: visitor.id,
            tenant_id: tenantId,
            name: visitor.name,
            id_number: visitor.idNumber,
            company: visitor.company,
            vehicle_plate: visitor.vehiclePlate,
            check_in_time: visitor.checkInTime,
            check_out_time: visitor.checkOutTime,
            status: visitor.status,
          }),
          'visitors REGISTER'
        );
      }
      break;
    }
    case 'CHECKOUT_VISITOR': {
      const { visitorId } = payload;
      const visitor = (state.visitors || []).find((v) => v.id === visitorId);
      if (visitor) {
        await requireDbOk(
          await db.from('visitors').update({
            status: visitor.status,
            check_out_time: visitor.checkOutTime,
          }).eq('id', visitorId),
          'visitors CHECKOUT'
        );
      }
      break;
    }
    default:
      break;
  }
}
