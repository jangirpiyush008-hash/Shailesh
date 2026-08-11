// Server-only: uses cookies() via createClient. Never import into a client component.
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/permissions";

export async function currentProfile(): Promise<CurrentProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try full select including overrides (post-migration 0006)
  const full = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level, permissions_overrides")
    .eq("id", user.id)
    .maybeSingle();
  if (!full.error && full.data) return full.data as CurrentProfile;

  // Fallback A: overrides column missing (pre-0006)
  const mid = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level")
    .eq("id", user.id)
    .maybeSingle();
  if (!mid.error && mid.data) return { ...(mid.data as any), permissions_overrides: {} } as CurrentProfile;

  // Fallback B: access_level column missing (pre-0005)
  const legacy = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!legacy.error && legacy.data) {
    const p = legacy.data as any;
    return { ...p, access_level: p.role === "employee" ? "view" : "full", permissions_overrides: {} };
  }
  return null;
}
