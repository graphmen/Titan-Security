import { createHash, timingSafeEqual } from 'node:crypto';

/** Subscription tiers — billing integration can replace token activation later. */
export const SUBSCRIPTION_TIERS = {
  standard: {
    id: 'standard',
    label: 'Core',
    planLabel: 'Growth Trial',
    description: 'Essential guard operations — attendance, patrol, SOS, and incident logging.',
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    planLabel: 'Premium',
    description: 'Phase 2 advanced monitoring, client reporting, and compliance tooling.',
  },
};

/** Phase 2 capabilities included in Premium. */
export const PREMIUM_FEATURES = {
  welfareChecks: true,
  geofenceExit: true,
  guardStatusBoard: true,
  clientPortal: true,
  reportExports: true,
  incidentEscalation: true,
  overduePatrolMonitoring: true,
  premiseRules: true,
  gpsAntiSpoof: true,
  shiftHandover: true,
};

export const PREMIUM_FEATURE_LABELS = {
  welfareChecks: 'Welfare / dead-man checks',
  geofenceExit: 'Geofence exit alerts',
  guardStatusBoard: 'Live guard status board',
  clientPortal: 'Client portal',
  reportExports: 'CSV report exports',
  incidentEscalation: 'Incident escalation & SLA',
  overduePatrolMonitoring: 'Overdue patrol monitoring',
  premiseRules: 'Per-site monitoring rules',
  gpsAntiSpoof: 'GPS anti-spoof validation',
  shiftHandover: 'Shift handover notes',
};

/** System settings that require Premium to enable or change. */
export const PREMIUM_SETTING_KEYS = new Set([
  'welfareChecksEnabled',
  'welfareCheckIntervalMinutes',
  'welfareResponseGraceMinutes',
  'welfareAlertRepeatMinutes',
  'geofenceExitAlertsEnabled',
  'geofenceExitGraceMinutes',
  'geofenceAlertRepeatMinutes',
  'premiseMonitoringRules',
  'overduePatrolRepeatMinutes',
]);

const PREMIUM_ACTIONS = new Set([
  'WELFARE_ACK',
  'ACK_SHIFT_HANDOVER',
  'UPDATE_PREMISE_MONITORING',
]);

function safeEqual(a, b) {
  const aa = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function normalizeTenantSubscription(tenant) {
  if (!tenant) return null;
  if (!tenant.subscriptionTier) {
    tenant.subscriptionTier = tenant.plan === 'Premium' ? 'premium' : 'standard';
  }
  if (!['standard', 'premium'].includes(tenant.subscriptionTier)) {
    tenant.subscriptionTier = 'standard';
  }
  return tenant;
}

export function getTenantRecord(state, tenantId) {
  const tenant = state?.tenants?.[tenantId];
  return normalizeTenantSubscription(tenant);
}

export function isPremiumTenant(state, tenantId) {
  const tenant = getTenantRecord(state, tenantId);
  return tenant?.subscriptionTier === 'premium';
}

export function hasPremiumFeature(state, tenantId, featureKey) {
  if (!PREMIUM_FEATURES[featureKey]) return true;
  return isPremiumTenant(state, tenantId);
}

export function getFeatureAccess(state, tenantId) {
  const isPremium = isPremiumTenant(state, tenantId);
  const features = {};
  for (const key of Object.keys(PREMIUM_FEATURES)) {
    features[key] = isPremium;
  }
  return features;
}

export function getSubscriptionPackages() {
  return Object.values(SUBSCRIPTION_TIERS).map((tier) => ({
    ...tier,
    isPremium: tier.id === 'premium',
    featureList:
      tier.id === 'premium'
        ? Object.values(PREMIUM_FEATURE_LABELS)
        : [
            'Guard & supervisor PIN auth',
            'GPS clock-in & geofence radius',
            'NFC patrol checkpoints',
            'SOS panic alerts',
            'Occurrence book & incidents',
            'Shift compliance alerts',
            'License expiry warnings',
          ],
  }));
}

export function getSubscriptionSummary(state, tenantId) {
  const tenant = getTenantRecord(state, tenantId);
  const tierId = tenant?.subscriptionTier || 'standard';
  const tier = SUBSCRIPTION_TIERS[tierId] || SUBSCRIPTION_TIERS.standard;
  const tokenConfigured = Boolean((process.env.PREMIUM_ACCESS_TOKEN || '').trim());

  return {
    tier: tierId,
    tierLabel: tier.label,
    planLabel: tenant?.plan || tier.planLabel,
    isPremium: tierId === 'premium',
    features: getFeatureAccess(state, tenantId),
    packages: getSubscriptionPackages(),
    premiumActivatedAt: tenant?.premiumActivatedAt || null,
    subscriptionSource: tenant?.subscriptionSource || (tierId === 'premium' ? 'legacy' : 'default'),
    tokenActivationAvailable: tokenConfigured,
  };
}

export function enrichStateWithSubscription(state) {
  if (!state) return state;
  const tenantId = state.activeTenantId || 'titan';
  for (const tid of Object.keys(state.tenants || {})) {
    normalizeTenantSubscription(state.tenants[tid]);
  }
  return {
    ...state,
    subscription: getSubscriptionSummary(state, tenantId),
  };
}

export function validatePremiumActivationToken(token) {
  const expected = (process.env.PREMIUM_ACCESS_TOKEN || '').trim();
  if (!expected) {
    return {
      ok: false,
      error: 'Premium token activation is not configured on this server. Set PREMIUM_ACCESS_TOKEN in environment.',
    };
  }
  const provided = String(token || '').trim();
  if (!provided) {
    return { ok: false, error: 'Enter your premium access token.' };
  }
  if (!safeEqual(provided, expected)) {
    return { ok: false, error: 'Invalid premium access token.' };
  }
  return { ok: true };
}

export function assertPremiumSettingsAllowed(state, tenantId, updates) {
  if (!updates || typeof updates !== 'object') return { ok: true };
  if (isPremiumTenant(state, tenantId)) return { ok: true };

  for (const key of Object.keys(updates)) {
    if (!PREMIUM_SETTING_KEYS.has(key)) continue;
    const value = updates[key];
    if (key === 'premiseMonitoringRules') {
      if (value && typeof value === 'object' && Object.keys(value).length > 0) {
        return premiumRequiredError(key);
      }
      continue;
    }
    if (key.endsWith('Enabled') && value === false) continue;
    if (value === undefined || value === null) continue;
    return premiumRequiredError(key);
  }
  return { ok: true };
}

export function assertPremiumActionAllowed(state, tenantId, action) {
  if (!PREMIUM_ACTIONS.has(action)) return { ok: true };
  if (isPremiumTenant(state, tenantId)) return { ok: true };
  return {
    ok: false,
    error: 'This action requires a Premium subscription.',
    status: 403,
  };
}

function premiumRequiredError(settingKey) {
  const label = PREMIUM_FEATURE_LABELS[settingKey] || settingKey;
  return {
    ok: false,
    error: `${label} is a Premium feature. Activate Premium or enter your access token in Master Admin.`,
    status: 403,
  };
}

/** In LOCAL_EVAL_MODE, premium applies only after token entry per admin session. */
function evalPremiumSessionStore() {
  if (!globalThis.__titanEvalPremiumSessions) {
    globalThis.__titanEvalPremiumSessions = {};
  }
  return globalThis.__titanEvalPremiumSessions;
}

// Drop legacy global store from earlier builds (caused premium for everyone).
delete globalThis.__titanEvalPremiumTenants;

export function isLocalEvalSubscriptionMode() {
  return process.env.LOCAL_EVAL_MODE === '1';
}

export function getAdminSessionKey(session) {
  if (session?.role !== 'admin' || !session.email) return null;
  return String(session.email).trim().toLowerCase();
}

/** Remember premium for this admin session only (local eval — not saved to prod DB). */
export function registerEvalPremiumSession(sessionKey, tenantId, override) {
  if (!isLocalEvalSubscriptionMode() || !sessionKey || !tenantId || !override) return;
  const store = evalPremiumSessionStore();
  if (!store[sessionKey]) store[sessionKey] = {};
  store[sessionKey][tenantId] = { ...override };
}

export function clearEvalPremiumSession(sessionKey) {
  if (!sessionKey) {
    globalThis.__titanEvalPremiumSessions = {};
    return;
  }
  delete evalPremiumSessionStore()[sessionKey];
}

/** Apply premium only when this admin entered the token in the current session. */
export function applyEvalSubscriptionOverrides(state, sessionKey) {
  if (!isLocalEvalSubscriptionMode() || !sessionKey || !state?.tenants) return state;
  const byTenant = evalPremiumSessionStore()[sessionKey];
  if (!byTenant) return state;
  for (const [tenantId, patch] of Object.entries(byTenant)) {
    if (state.tenants[tenantId]) {
      Object.assign(state.tenants[tenantId], patch);
    }
  }
  return state;
}

export function hasEvalPremiumSession(sessionKey, tenantId = 'titan') {
  return Boolean(evalPremiumSessionStore()[sessionKey]?.[tenantId]);
}

/** Hash token for audit logs without storing the raw secret. */
export function hashTokenForAudit(token) {
  return createHash('sha256').update(String(token || '')).digest('hex').slice(0, 12);
}
