import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boaqaihymgmrhnjtiqrs.supabase.co';
const supabaseAnonKey = 'sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
