import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";
import { sendText, isWhatsAppConfigured } from "@/lib/whatsapp/messenger";
import { logMessage } from "@/lib/whatsapp/session";
import { M } from "@/lib/whatsapp/menu";

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
  const permissions_overrides = body.permissions_overrides && typeof body.permissions_overrides === "object"
    ? body.permissions_overrides : {};

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

  // ------ Duplicate checks BEFORE creating the auth user ------
  // Email uniqueness — Supabase auth also enforces this, but check first for a friendly error
  const { data: existingByEmail } = await admin
    .from("profiles").select("id, full_name, email")
    .eq("email", email).maybeSingle();
  if (existingByEmail) {
    return NextResponse.json({
      error: `A user with email "${email}" already exists (${existingByEmail.full_name ?? "no name"}). Pick a different email.`,
      code: "duplicate_email",
    }, { status: 409 });
  }
  // Phone uniqueness (only if phone provided)
  if (phone_number) {
    const { data: existingByPhone } = await admin
      .from("profiles").select("id, full_name, email, phone_number")
      .eq("phone_number", phone_number).maybeSingle();
    if (existingByPhone) {
      return NextResponse.json({
        error: `Phone number "${phone_number}" is already assigned to ${existingByPhone.full_name ?? existingByPhone.email}. Use a different number.`,
        code: "duplicate_phone",
      }, { status: 409 });
    }
  }

  // Only keep known permission override keys with boolean values
  const ALLOWED_PERMS = new Set([
    "canSeeRevenue","canSeeProfit","canSeeTotals","canSeeLinePrices",
    "canSeeOverviewTab","canSeeReportsTab","canExportExcel","canGenerateReport",
    "canCreateProject","canEditProject","canDeleteProject",
    "canAddExpense","canEnterPrice","canDeleteExpense","canManageUsers",
  ]);
  const cleanOverrides: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(permissions_overrides)) {
    if (ALLOWED_PERMS.has(k) && typeof v === "boolean") cleanOverrides[k] = v;
  }

  // Create the auth user (the on_auth_user_created trigger creates a profile row automatically)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) {
    // Supabase's own duplicate-detection as a safety net
    const msg = /already been registered|duplicate/i.test(error.message)
      ? `A user with email "${email}" already exists.`
      : error.message;
    return NextResponse.json({ error: msg, code: "auth_create_failed" }, { status: 400 });
  }

  // Force the profile role + access_level + phone + overrides
  if (data.user) {
    await admin.from("profiles")
      .update({ role, access_level, full_name, phone_number, permissions_overrides: cleanOverrides })
      .eq("id", data.user.id);
  }

  // We do NOT auto-send the welcome message.
  // Admin is presented with a follow-up step in the UI to send credentials on WhatsApp.
  return NextResponse.json({
    ok: true,
    id: data.user?.id,
    email,
    phone_number,
    role,
    full_name,
    // Pass the password back to the UI ONLY for the ephemeral "send credentials" dialog
    // (never persisted — the UI drops it as soon as admin closes the dialog)
    temp_password: password,
    whatsapp_configured: isWhatsAppConfigured(),
  });
}
