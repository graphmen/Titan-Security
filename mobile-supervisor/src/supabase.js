import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://miicieildnocxatiytde.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CwyeFQdM45E31U1jNH8GtQ_J7AddXoq';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
