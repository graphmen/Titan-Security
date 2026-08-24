/** Whether API routes should read/write Supabase instead of in-memory demo store. */
export function isForceSupabaseEnabled() {
  if (process.env.FORCE_SUPABASE === '1') return true;
  if (process.env.FORCE_SUPABASE === '0') return false;
  // Live site must never serve empty in-memory demo state.
  if (process.env.VERCEL_ENV === 'production') return true;
  return false;
}
