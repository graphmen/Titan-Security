import { pushRecurringComplianceAlert } from './guards.js';
import { getDefaultPatrolSchedule, parseScheduleIntervalMs } from './patrolSchedule.js';

/** @deprecated use parseScheduleIntervalMs */
export function parseScheduleHours(schedule = '') {
  return parseScheduleIntervalMs(schedule) / (60 * 60 * 1000);
}

export function isCheckpointOverdue(cp, now = Date.now()) {
  if (!cp) return false;
  const schedule = cp.schedule || '';
  if (/shift/i.test(schedule)) return cp.status !== 'Scanned';
  const intervalMs = parseScheduleIntervalMs(schedule);
  if (!cp.lastScanned) return true;
  return now - new Date(cp.lastScanned).getTime() > intervalMs;
}

/** Alert supervisors when on-duty guards miss scheduled checkpoint scans. */
export function evaluateOverduePatrolAlerts(state, tenantId) {
  const repeatMinutes = Number(state?.systemSettings?.overduePatrolRepeatMinutes) || 30;
  const attendance = (state.attendance?.[tenantId] || []).filter(
    (a) => a.status === 'On Duty' || a.status === 'Late'
  );
  const checkpoints = state.checkpoints?.[tenantId] || [];
  const premises = state.premises?.[tenantId] || [];
  const fallbackSchedule = getDefaultPatrolSchedule(state);

  attendance.forEach((att) => {
    const guardName = (state.guards?.[tenantId] || []).find((g) => g.id === att.guardId)?.fullName || 'Guard';
    const premise = premises.find((p) => p.id === att.premiseId);
    const siteCheckpoints = checkpoints.filter((cp) => cp.premiseId === att.premiseId);
    const overdue = siteCheckpoints.filter((cp) => isCheckpointOverdue(cp));

    overdue.forEach((cp) => {
      pushRecurringComplianceAlert(state, tenantId, {
        type: 'overdue_patrol',
        severity: 'warning',
        guardId: att.guardId,
        guardName,
        premiseId: att.premiseId,
        message: `${guardName} — checkpoint "${cp.name}" overdue at ${premise?.name || 'site'} (schedule: ${cp.schedule || fallbackSchedule}).`,
      }, repeatMinutes);
    });
  });
}

export function patrolComplianceRate(checkpoints = []) {
  if (!checkpoints.length) return 100;
  const overdue = checkpoints.filter((cp) => isCheckpointOverdue(cp)).length;
  return Math.round(((checkpoints.length - overdue) / checkpoints.length) * 100);
}
