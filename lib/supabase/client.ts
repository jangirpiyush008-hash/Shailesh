"use client";
import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Don't throw during React render — throw only when someone actually
    // tries to call auth/db methods. Callers should use isSupabaseConfigured()
    // to check first if they need to render a "setup required" UI.
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(url, key);
}
