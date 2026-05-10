import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://tdvqwbvptpjbutluiiln.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdnF3YnZwdHBqYnV0bHVpaWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUyODksImV4cCI6MjA5MzgxMTI4OX0.uiRxqyI9zs7kE4r5TXPQp9t1y_ZWbCiYbrLSmiNmIwI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseClient = typeof supabase;
