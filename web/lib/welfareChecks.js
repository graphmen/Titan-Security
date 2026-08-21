import { pushRecurringComplianceAlert, getActiveAttendanceForGuard } from './guards.js';
import { getPremiseMonitoringRules } from './premiseRules.js';
import { mergeSystemSettings } from './systemSettings.js';

export function evaluateWelfareChecks(state, tenantId) {
  const global = mergeSystemSettings(state?.systemSettings);
  if (!global.welfareChecksEnabled) return;

  const now = Date.now();
  const onDuty = (state.attendance?.[tenantId] || []).filter(
    (a) => a.status === 'On Duty' || a.status === 'Late'
  );

  onDuty.forEach((att) => {
    const rules = getPremiseMonitoringRules(state, tenantId, att.premiseId);
    if (!rules.welfareCheckEnabled) return;

    const intervalMs = rules.welfareIntervalMinutes * 60 * 1000;
    const lastPrompt = att.lastWelfarePromptAt ? new Date(att.lastWelfarePromptAt).getTime() : new Date(att.clockIn).getTime();
    const lastAck = att.lastWelfareAckAt ? new Date(att.lastWelfareAckAt).getTime() : new Date(att.clockIn).getTime();

    if (now - lastPrompt >= intervalMs) {
      att.lastWelfarePromptAt = new Date().toISOString();
      att.welfarePending = true;
    }

    if (!att.welfarePending) return;

    const graceMs = (Number(global.welfareResponseGraceMinutes) || 5) * 60 * 1000;
    if (now - lastAck >= intervalMs && now - new Date(att.lastWelfarePromptAt).getTime() > graceMs) {
      const guardName = (state.guards?.[tenantId] || []).find((g) => g.id === att.guardId)?.fullName || 'Guard';
      pushRecurringComplianceAlert(state, tenantId, {
        type: 'welfare_check',
        severity: 'critical',
        guardId: att.guardId,
        guardName,
        premiseId: att.premiseId,
        message: `${guardName} has not confirmed welfare check — no response for ${rules.welfareIntervalMinutes}+ minutes.`,
      }, Number(global.welfareAlertRepeatMinutes) || 30);
    }
  });
}

export function acknowledgeWelfareCheck(state, tenantId, guardId) {
  const record = getActiveAttendanceForGuard(state, tenantId, guardId);
  if (!record) return false;
  record.lastWelfareAckAt = new Date().toISOString();
  record.welfarePending = false;
  return true;
}
