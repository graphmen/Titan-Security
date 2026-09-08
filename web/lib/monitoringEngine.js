import {
  evaluateLicenseExpiryAlerts,
  evaluateShiftCompliance,
  evaluateAllOnDutyGuards,
  consolidateGuardAlerts,
} from './guards.js';
import { evaluateOverduePatrolAlerts } from './patrolMonitoring.js';
import { evaluateWelfareChecks } from './welfareChecks.js';
import { evaluateIncidentEscalation } from './incidentEscalation.js';
import { hasPremiumFeature } from './subscription.js';
import { archiveStaleOperationalRecords } from './historyArchive.js';
import { advancePastShiftStatuses } from './shiftValidation.js';

/** Run all server-side monitoring evaluators (called on each state read). */
export function runMonitoringEvaluators(state, tenantId) {
  if (!state || !tenantId) return state;
  consolidateGuardAlerts(state, tenantId);
  advancePastShiftStatuses(state, tenantId);
  archiveStaleOperationalRecords(state, tenantId);
  evaluateLicenseExpiryAlerts(state, tenantId);
  evaluateShiftCompliance(state, tenantId);
  evaluateAllOnDutyGuards(state, tenantId);
  if (hasPremiumFeature(state, tenantId, 'overduePatrolMonitoring')) {
    evaluateOverduePatrolAlerts(state, tenantId);
  }
  if (hasPremiumFeature(state, tenantId, 'welfareChecks')) {
    evaluateWelfareChecks(state, tenantId);
  }
  if (hasPremiumFeature(state, tenantId, 'incidentEscalation')) {
    evaluateIncidentEscalation(state, tenantId);
  }
  return state;
}
