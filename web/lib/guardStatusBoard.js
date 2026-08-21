import { isCheckpointOverdue } from './patrolMonitoring.js';
import { getPremiseMonitoringRules } from './premiseRules.js';

function minutesAgo(iso) {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export function buildGuardStatusCards(state, tenantId) {
  const guards = state.guards?.[tenantId] || [];
  const premises = state.premises?.[tenantId] || [];
  const checkpoints = state.checkpoints?.[tenantId] || [];
  const alerts = state.guardAlerts?.[tenantId] || [];
  const onDuty = (state.attendance?.[tenantId] || []).filter(
    (a) => a.status === 'On Duty' || a.status === 'Late'
  );

  return onDuty.map((att) => {
    const guard = guards.find((g) => g.id === att.guardId);
    const premise = premises.find((p) => p.id === att.premiseId);
    const siteCps = checkpoints.filter((cp) => cp.premiseId === att.premiseId);
    const overduePatrol = siteCps.some((cp) => isCheckpointOverdue(cp));
    const activeAlerts = alerts.filter((a) => a.guardId === att.guardId && a.status === 'Active');
    const hasSos = Object.values(state.activeSosAlerts || {}).some(
      (s) => s?.active && s.guardId === att.guardId
    );
    const gpsMins = minutesAgo(att.lastCoords?.at || att.lastMovementAt || att.clockIn);
    const lastPatrol = siteCps
      .map((cp) => cp.lastScanned)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const patrolMins = minutesAgo(lastPatrol);

    let status = 'green';
    const reasons = [];

    if (hasSos || activeAlerts.some((a) => a.type === 'welfare_check' || a.severity === 'critical')) {
      status = 'red';
      reasons.push('Critical alert or SOS');
    } else if (att.geofenceViolation || activeAlerts.some((a) => a.type === 'geofence_exit')) {
      status = 'red';
      reasons.push('Outside geofence');
    } else if (overduePatrol || att.needsMovementAck || att.welfarePending) {
      status = 'amber';
      if (overduePatrol) reasons.push('Overdue patrol');
      if (att.needsMovementAck) reasons.push('No movement');
      if (att.welfarePending) reasons.push('Welfare check pending');
    }

    if (gpsMins != null && gpsMins > 10) {
      status = status === 'green' ? 'amber' : status;
      reasons.push(`Stale GPS (${gpsMins}m)`);
    }

    return {
      guardId: att.guardId,
      guardName: guard?.fullName || 'Guard',
      premiseId: att.premiseId,
      premiseName: premise?.name || 'Site',
      status,
      reasons,
      clockIn: att.clockIn,
      gpsMinutesAgo: gpsMins,
      patrolMinutesAgo: patrolMins,
      activeAlertCount: activeAlerts.length,
      monitoringRules: getPremiseMonitoringRules(state, tenantId, att.premiseId),
    };
  });
}
