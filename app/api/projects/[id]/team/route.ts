import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/projects/[id]/team  Body: { user_id, role? } — add a team member (admin only) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentProfile();
  if (!permissions(me).canManageUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  if (!body?.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from("project_team").insert({
    project_id: params.id,
    user_id: body.user_id,
    role: body.role ?? "member",
  });
  if (error && !/duplicate/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/[id]/team?user=... — remove a team member (admin only) */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentProfile();
  if (!permissions(me).canManageUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = new URL(req.url).searchParams.get("user");
  if (!userId) return NextResponse.json({ error: "user param required" }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from("project_team").delete()
    .eq("project_id", params.id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
