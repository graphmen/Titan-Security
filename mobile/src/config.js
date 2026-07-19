/** Built-in defaults for Titan Monitor APK (override via mobile/.env at build time). */
export const DEFAULT_API_URL =
  import.meta.env.VITE_API_URL || 'https://titan-security.vercel.app';

export const DEFAULT_TENANT_ID = 'titan';

/** Match web dashboard polling — avoids hammering /api/state. */
export const STATE_POLL_MS = 10000;

export const APP_VERSION = '1.0.14';
export const APP_VERSION_CODE = 14;

export const MOBILE_APP_ID = 'monitor';
