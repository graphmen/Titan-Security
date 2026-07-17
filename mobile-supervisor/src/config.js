export const DEFAULT_API_URL =
  import.meta.env.VITE_API_URL || 'https://titan-security.vercel.app';

export const DEFAULT_TENANT_ID = 'titan';
export const STATE_POLL_MS = 15000;
export const APP_VERSION = '1.1.2';

/** Must match android/app/build.gradle versionCode — used for OTA update checks. */
export const APP_VERSION_CODE = 12;

export const MOBILE_APP_ID = 'supervisor';
