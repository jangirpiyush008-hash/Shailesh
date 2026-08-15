import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";
import { sendText, isWhatsAppConfigured } from "@/lib/whatsapp/messenger";
import { logMessage } from "@/lib/whatsapp/session";
import { M } from "@/lib/whatsapp/menu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/users/[id]/send-credentials
 * Body: { password: string }
 *
 * Sends the WhatsApp welcome message with credentials to the user.
 * The password comes from the client because we don't want to store or
 * expose it server-side after creation. Admin-only.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentProfile();
  if (!me || !permissions(me).canManageUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const password = String(body.password || "");
  if (!password) return NextResponse.json({ error: "password required" }, { status: 400 });

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ error: "WhatsApp is not configured yet. Add WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID in Railway Variables first." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, full_name, email, role, phone_number")
    .eq("id", params.id)
    .single();
  if (error || !profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!profile.phone_number) return NextResponse.json({ error: "This user has no phone number saved" }, { status: 400 });

  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shailesh-production.up.railway.app";
  const messageBody = profile.role === "admin"
    ? M.welcomeAdmin({ name: profile.full_name ?? "", email: profile.email, password, loginUrl, adminName: me.full_name ?? undefined })
    : M.welcomeCoordinator({ name: profile.full_name ?? "", role: profile.role, email: profile.email, password, loginUrl, adminName: me.full_name ?? undefined });

  const res = await sendText(profile.phone_number, messageBody);

  await logMessage({
    direction: "outbound",
    phone_number: profile.phone_number,
    profile_id: profile.id,
    wa_message_id: res.id,
    body: messageBody,
    parsed_intent: "credentials_sent",
    meta: { role: profile.role, sent_by_admin: me.id, error: res.error, manual_trigger: true },
  });

  if (res.error) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, sent_to: profile.phone_number });
}
