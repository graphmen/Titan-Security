import { pushGuardAlert } from './guards.js';
import { getSupervisorsForTerritory } from './guardProfile.js';
import { queuePushNotification } from './pushNotifications.js';

const HIGH_SEVERITY_TYPES = new Set(['Assault', 'Fire', 'Theft', 'Break-in', 'Medical Emergency']);

export function processIncidentOnCreate(state, tenantId, incident) {
  const guard = (state.guards?.[tenantId] || []).find((g) => g.id === incident.guardId);
  const territoryId = guard?.territoryId || guard?.assignedTerritoryIds?.[0];
  const supervisors = territoryId ? getSupervisorsForTerritory(state, tenantId, territoryId) : [];
  const supervisor = supervisors[0];

  incident.assignedSupervisorId = supervisor?.id || null;
  incident.assignedSupervisorName = supervisor?.fullName || null;
  incident.assignedAt = supervisor ? new Date().toISOString() : null;
  incident.escalationLevel = 0;
  incident.slaDueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (supervisor) {
    incident.status = 'Investigating';
  }

  const isHigh = HIGH_SEVERITY_TYPES.has(incident.type);
  if (isHigh) {
    pushGuardAlert(state, tenantId, {
      type: 'incident_escalation',
      severity: 'critical',
      guardId: incident.guardId,
      guardName: incident.guardName,
      message: `High-severity incident: ${incident.type} — ${incident.guardName}. Immediate attention required.`,
    });
    queuePushNotification({
      type: 'incident_critical',
      tenantId,
      title: 'Critical incident',
      body: `${incident.type}: ${incident.guardName}`,
    });
  }
}

export function evaluateIncidentEscalation(state, tenantId) {
  const now = Date.now();
  (state.occurrenceBook || []).forEach((inc) => {
    if (inc.tenantId && inc.tenantId !== tenantId) return;
    if (!inc.type || inc.type === 'Patrol Tap' || inc.type === 'Shift Clock-In' || inc.type === 'Shift Clock-Out') return;
    if (inc.status === 'Resolved') return;

    if (inc.status === 'Unassigned' && inc.slaDueAt && now > new Date(inc.slaDueAt).getTime()) {
      inc.escalationLevel = (inc.escalationLevel || 0) + 1;
      inc.slaDueAt = new Date(now + 15 * 60 * 1000).toISOString();
      pushGuardAlert(state, tenantId, {
        type: 'incident_sla',
        severity: 'warning',
        guardId: inc.guardId,
        guardName: inc.guardName,
        message: `Incident SLA breach: "${inc.type}" still unassigned — ${inc.guardName}.`,
      });
    }
  });
}
