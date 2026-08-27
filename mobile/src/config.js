/** Production API — always used in release APK builds (ignore .env.local). */
const PRODUCTION_API_URL = 'https://titanprotection.org';

/** Dev-only override (vite proxy or LAN). Release builds always use PRODUCTION_API_URL. */
export const DEFAULT_API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || '')
  : PRODUCTION_API_URL;

export const DEFAULT_TENANT_ID = 'titan';

/** Match web dashboard polling — avoids hammering /api/state. */
export const STATE_POLL_MS = 10000;

export const APP_VERSION = '1.0.31';
export const APP_VERSION_CODE = 31;

export const MOBILE_APP_ID = 'monitor';
