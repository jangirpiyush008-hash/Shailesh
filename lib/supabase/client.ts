"use client";
import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  // Strip whitespace defensively — copy-paste often introduces stray spaces
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\s+/g, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, "");
  if (!url || !key) {
    // Don't throw during React render — return a null-cast so callers using
    // isSupabaseConfigured() can render a "setup required" UI instead
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(url, key);
}
