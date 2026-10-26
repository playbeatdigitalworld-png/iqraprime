import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yxUeNftpgXnveqNoQdmiLQ_GbIRJ492';

let serverSupabase: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  if (!serverSupabase) {
    try {
      serverSupabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize server-side Supabase client:', err);
      return null;
    }
  }
  return serverSupabase;
}

export const supabaseServer = getServerSupabase();

/**
 * Service-role client (bypasses RLS). Used ONLY by server-side durable
 * vault paths (member_iptv_lines sync/restore/purge). Requires the owner
 * provisioned SUPABASE_SERVICE_ROLE_KEY; returns null otherwise so callers
 * degrade gracefully to the runtime (memory) store.
 * NEVER import this into anything that handles client requests directly —
 * the anon client above remains the default for all other server work.
 */
let serviceSupabase: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  if (!serviceSupabase) {
    try {
      serviceSupabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize service-role Supabase client:', err);
      return null;
    }
  }
  return serviceSupabase;
}
