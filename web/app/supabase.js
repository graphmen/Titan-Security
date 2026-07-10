import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://miicieildnocxatiytde.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CwyeFQdM45E31U1jNH8GtQ_J7AddXoq';

/** Node on Windows can fail TLS verify for Supabase (UNABLE_TO_VERIFY_LEAF_SIGNATURE). */
const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

function supabaseFetch(url, options = {}) {
  return undiciFetch(url, { ...options, dispatcher: tlsAgent });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
});
