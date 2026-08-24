/** Whether API routes should read/write Supabase instead of in-memory demo store. */
export function isForceSupabaseEnabled() {
  if (process.env.FORCE_SUPABASE === '1') return true;
  // Hosted Vercel builds must use the database — empty in-memory demo breaks the live site.
  if (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production') return true;
  if (process.env.FORCE_SUPABASE === '0') return false;
  return false;
}
