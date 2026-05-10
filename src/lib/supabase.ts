import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boaqaihymgmrhnjtiqrs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvYXFhaWh5bWdtcmhuanRpcXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzMxNTMsImV4cCI6MjA5NDAwOTE1M30.w0lnEzJeWlF-NluSlt0wBhTr-bb3SJEKULq0Yb_NaKI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
