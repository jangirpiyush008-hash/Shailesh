/**
 * WhatsApp conversation state machine.
 *
 * States:
 *   idle              — no active flow, waiting for user
 *   picking_project   — showing project list, waiting for selection
 *   picking_side      — labour vs materials
 *   picking_category  — expense category
 *   entering_description
 *   entering_quantity
 *   entering_hours    — labour only
 *   entering_rate
 *   confirming        — showing summary + [Save/Cancel] buttons
 *
 * Context (jsonb) accumulates: { project_id, project_code, side, category_id,
 *                                category_name, description, unit, quantity,
 *                                total_hours, unit_price }
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type WASession = {
  phone_number: string;
  profile_id: string | null;
  state: string;
  context: Record<string, any>;
};

export async function getOrCreateSession(phone: string, profileId: string | null): Promise<WASession> {
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_sessions").select("*").eq("phone_number", phone).maybeSingle();
  if (data) return data as WASession;
  const { data: created } = await admin.from("whatsapp_sessions")
    .insert({ phone_number: phone, profile_id: profileId, state: "idle", context: {} })
    .select("*").single();
  return created as WASession;
}

export async function updateSession(phone: string, patch: Partial<WASession>): Promise<void> {
  const admin = createAdminClient();
  await admin.from("whatsapp_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("phone_number", phone);
}

export async function resetSession(phone: string): Promise<void> {
  await updateSession(phone, { state: "idle", context: {} });
}

export async function logMessage(params: {
  direction: "inbound" | "outbound";
  phone_number: string;
  profile_id?: string | null;
  wa_message_id?: string | null;
  body?: string;
  parsed_intent?: string;
  meta?: any;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("whatsapp_messages").insert({
    direction: params.direction,
    phone_number: params.phone_number,
    profile_id: params.profile_id ?? null,
    wa_message_id: params.wa_message_id ?? null,
    body: params.body ?? null,
    parsed_intent: params.parsed_intent ?? null,
    meta: params.meta ?? {},
  });
}
