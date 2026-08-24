/** Whether API routes should read/write Supabase instead of in-memory demo store. */
export function isForceSupabaseEnabled() {
  if (process.env.FORCE_SUPABASE === '1') return true;
  if (process.env.FORCE_SUPABASE === '0') return false;
  // Vercel production: auto-connect when DB credentials are configured (avoids empty demo after env drift).
  if (
    process.env.VERCEL_ENV === 'production' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return true;
  }
  return false;
}
