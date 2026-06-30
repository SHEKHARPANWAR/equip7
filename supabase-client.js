// Supabase client setup.
// Uses the same project credentials referenced in the original server.ts
// fallback defaults. Replace these with your own project's values if needed.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://vayzgyadhfwvyfsxkwrv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Ukasj4C0e3IiKDfBHH1KWA_MmAYKXcG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
