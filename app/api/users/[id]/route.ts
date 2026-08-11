import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentProfile, permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH /api/users/[id] — update role/access_level/full_name (admin only) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentProfile();
  if (!me || !permissions(me).canManageUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: any = {};
  if (body.role && ["admin", "coordinator", "employee"].includes(body.role)) update.role = body.role;
  if (body.access_level && ["full", "edit", "read", "view"].includes(body.access_level)) update.access_level = body.access_level;
  if (typeof body.full_name === "string") update.full_name = body.full_name.trim();
  if (body.permissions_overrides && typeof body.permissions_overrides === "object") {
    // Only keep known permission keys with boolean values
    const ALLOWED = new Set([
      "canSeeRevenue","canSeeProfit","canSeeTotals","canSeeLinePrices",
      "canSeeOverviewTab","canSeeReportsTab","canExportExcel","canGenerateReport",
      "canCreateProject","canEditProject","canDeleteProject",
      "canAddExpense","canEnterPrice","canDeleteExpense","canManageUsers",
    ]);
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.permissions_overrides)) {
      if (ALLOWED.has(k) && typeof v === "boolean") clean[k] = v;
    }
    update.permissions_overrides = clean;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  let admin;
  try { admin = createAdminClient(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { error } = await admin.from("profiles").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/users/[id] — delete a user completely (admin only) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentProfile();
  if (!me || !permissions(me).canManageUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.id === me.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  let admin;
  try { admin = createAdminClient(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { error } = await admin.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // profiles row cascades via FK
  return NextResponse.json({ ok: true });
}
