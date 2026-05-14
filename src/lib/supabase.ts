import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://boaqaihymgmrhnjtiqrs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvYXFhaWhteWdtcmhuanRpcXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzMxNTMsImV4cCI6MjA5NDAwOTE1M30.w0lnEzJeWlF-NluSlt0wBhTr-bb3SJEKULq0Yb_NaKI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
