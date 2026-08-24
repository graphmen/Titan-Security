import { syncCheckpointFromPlace } from './premises.js';

/** Patrol interval options shown in Master Admin settings (minutes). */
export const PATROL_INTERVAL_OPTIONS_MINUTES = [15, 30, 45, 60, 90, 120];

export const LEGACY_PATROL_SCHEDULES = new Set([
  'Every 2 hours',
  'Every 1 hour',
  'Every 4 hours',
]);

/** Human-readable label for mobile + web, e.g. 30 → "Every 30 mins", 60 → "Every 1 hour". */
export function formatPatrolSchedule(minutes) {
  const m = Math.max(1, Math.round(Number(minutes) || 30));
  if (m >= 60 && m % 60 === 0) {
    const hours = m / 60;
    return hours === 1 ? 'Every 1 hour' : `Every ${hours} hours`;
  }
  return `Every ${m} mins`;
}

/** Parse schedule strings like "Every 30 mins" or "Every 2 hours" → milliseconds. */
export function parseScheduleIntervalMs(schedule = '') {
  const s = String(schedule).trim();
  if (/shift/i.test(s)) return 12 * 60 * 60 * 1000;
  const minMatch = s.match(/(\d+)\s*min/i);
  if (minMatch) return Math.max(1, parseInt(minMatch[1], 10)) * 60 * 1000;
  const hourMatch = s.match(/(\d+)\s*hour/i);
  if (hourMatch) return Math.max(1, parseInt(hourMatch[1], 10)) * 60 * 60 * 1000;
  return 30 * 60 * 1000;
}

export function getDefaultPatrolIntervalMinutes(state) {
  const n = Number(state?.systemSettings?.defaultPatrolIntervalMinutes);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function getDefaultPatrolSchedule(state) {
  return formatPatrolSchedule(getDefaultPatrolIntervalMinutes(state));
}

export function patrolScheduleOptions() {
  return PATROL_INTERVAL_OPTIONS_MINUTES.map((m) => formatPatrolSchedule(m));
}

/** Apply a schedule label to every patrol place + checkpoint for the tenant. */
export function applyPatrolScheduleToAllPlaces(state, tenantId, schedule) {
  if (!schedule) return 0;
  let updated = 0;
  for (const premise of state.premises?.[tenantId] || []) {
    for (const place of state.places?.[premise.id] || []) {
      place.schedule = schedule;
      syncCheckpointFromPlace(state, tenantId, premise, place);
      updated += 1;
    }
  }
  return updated;
}

/** One-time style migration: move legacy hour-based defaults to the configured interval. */
export function migrateLegacyPatrolSchedules(state, tenantId) {
  const target = getDefaultPatrolSchedule(state);
  let changed = 0;
  for (const premise of state.premises?.[tenantId] || []) {
    for (const place of state.places?.[premise.id] || []) {
      if (!place.schedule || LEGACY_PATROL_SCHEDULES.has(place.schedule)) {
        place.schedule = target;
        syncCheckpointFromPlace(state, tenantId, premise, place);
        changed += 1;
      }
    }
  }
  return changed;
}
