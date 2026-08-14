import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "./messenger";
import { M } from "./menu";
import { logMessage } from "./session";

/** Notify every admin (with a phone number + notify_on_updates=true) about a new entry. */
export async function notifyAdminsOfEntry(params: {
  actor_name: string;
  project_code: string;
  project_name: string;
  category: string;
  description: string;
  quantity: number;
  unit?: string;
  hours?: number;
  rate: number;
  total: number;
  exclude_phone?: string;    // don't notify the person who just added it
}): Promise<void> {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id, full_name, phone_number, notify_on_updates")
    .eq("role", "admin")
    .not("phone_number", "is", null)
    .eq("notify_on_updates", true);

  if (!admins?.length) return;

  const msg = M.adminNotification({
    user_name: params.actor_name,
    project_code: params.project_code,
    project_name: params.project_name,
    category: params.category,
    description: params.description,
    quantity: params.quantity,
    unit: params.unit,
    hours: params.hours,
    rate: params.rate,
    total: params.total,
  });

  await Promise.all(admins.map(async (a) => {
    if (!a.phone_number || a.phone_number === params.exclude_phone) return;
    const res = await sendText(a.phone_number, msg);
    await logMessage({
      direction: "outbound",
      phone_number: a.phone_number,
      profile_id: a.id,
      wa_message_id: res.id,
      body: msg,
      parsed_intent: "admin_notification",
      meta: { error: res.error, exclude_phone: params.exclude_phone },
    });
  }));
}
