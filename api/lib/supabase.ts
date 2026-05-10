import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-side Supabase client with service role (for admin operations)
export function createServerClient() {
  // For server operations, we use the anon key
  // In production, you should use the service_role key for admin operations
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Admin client (for operations that bypass RLS)
export function createAdminClient() {
  // If service role key is available, use it; otherwise fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.supabaseAnonKey;
  return createClient(env.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
