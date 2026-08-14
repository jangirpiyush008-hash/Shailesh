import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/users — create a new user (admin only)
 * Body: { email, password, full_name, role, access_level }
 */
export async function POST(req: NextRequest) {
  const me = await currentProfile();
  if (!me || !permissions(me).canManageUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const full_name = String(body.full_name || "").trim();
  const role = String(body.role || "employee");
  const access_level = String(body.access_level || (role === "employee" ? "view" : "full"));
  const phone_number = body.phone_number ? String(body.phone_number).trim() : null;

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "email, password, and full_name are required" }, { status: 400 });
  }
  if (!["admin", "coordinator", "employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!["full", "edit", "read", "view"].includes(access_level)) {
    return NextResponse.json({ error: "Invalid access_level" }, { status: 400 });
  }

  let admin;
  try { admin = createAdminClient(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  // Create the auth user (the on_auth_user_created trigger creates a profile row automatically)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Force the profile role + access_level + phone (trigger uses defaults, we want to be explicit)
  if (data.user) {
    await admin.from("profiles")
      .update({ role, access_level, full_name, phone_number })
      .eq("id", data.user.id);
  }

  return NextResponse.json({ ok: true, id: data.user?.id, email });
}
