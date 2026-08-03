import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Keep a singleton instance for SSR/Environment vars
let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  // First, check if instance already exists (e.g., created from local storage)
  if (supabaseInstance) return supabaseInstance;

  // Fallback to environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  }

  return null;
};

// Ability to manually initialize/update the client from local storage
export const initSupabase = (url: string, key: string) => {
  if (url && key) {
    supabaseInstance = createClient(url, key);
  } else {
    supabaseInstance = null;
  }
};
