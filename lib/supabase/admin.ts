import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. USE ONLY IN SERVER ROUTES that
 * have already checked the caller is an admin. Never expose to the browser.
 */
export function createAdminClient() {
  // Strip whitespace defensively — copy-paste from Supabase dashboard often
  // includes stray spaces / newlines that make the Bearer header invalid.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\s+/g, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/\s+/g, "");
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Railway → Variables. " +
      "Copy the 'service_role' key from Supabase → Settings → API → Project API keys → sb_secret_..."
    );
  }
  // Sanity check the key doesn't have any invalid characters left over
  if (!/^[A-Za-z0-9._~+/=-]+$/.test(serviceKey)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks malformed (contains invalid characters). " +
      "Please re-copy from Supabase dashboard → Settings → API → Secret keys and paste again in Railway. " +
      "Common cause: soft-wrapping introduced a space or newline."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
