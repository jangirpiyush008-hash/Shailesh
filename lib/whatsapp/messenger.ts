/**
 * Meta WhatsApp Cloud API — outbound message sender.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Env vars (set in Railway):
 *   WHATSAPP_ACCESS_TOKEN   — permanent token from Meta app
 *   WHATSAPP_PHONE_NUMBER_ID — the SBJ business phone id (numeric)
 *   WHATSAPP_VERIFY_TOKEN   — arbitrary string, same value set in Meta webhook config
 */

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type WAButton = { id: string; title: string };

/** Send a plain text message. */
export async function sendText(to: string, body: string): Promise<{ id?: string; error?: string }> {
  return await sendRaw(to, { type: "text", text: { body: body.slice(0, 4096), preview_url: false } });
}

/** Send an interactive list — up to 10 rows in one section. */
export async function sendList(to: string, params: {
  header?: string; body: string; footer?: string; buttonText: string;
  sectionTitle?: string;
  rows: { id: string; title: string; description?: string }[];
}): Promise<{ id?: string; error?: string }> {
  return await sendRaw(to, {
    type: "interactive",
    interactive: {
      type: "list",
      ...(params.header ? { header: { type: "text", text: params.header.slice(0, 60) } } : {}),
      body:   { text: params.body.slice(0, 1024) },
      ...(params.footer ? { footer: { text: params.footer.slice(0, 60) } } : {}),
      action: {
        button: params.buttonText.slice(0, 20),
        sections: [{
          title: (params.sectionTitle ?? "Options").slice(0, 24),
          rows: params.rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        }],
      },
    },
  });
}

/** Send interactive reply buttons — up to 3. */
export async function sendButtons(to: string, params: {
  body: string; footer?: string; buttons: WAButton[];
}): Promise<{ id?: string; error?: string }> {
  return await sendRaw(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: params.body.slice(0, 1024) },
      ...(params.footer ? { footer: { text: params.footer.slice(0, 60) } } : {}),
      action: {
        buttons: params.buttons.slice(0, 3).map((b) => ({
          type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** Low-level POST to Meta's Graph API. */
async function sendRaw(to: string, message: Record<string, any>): Promise<{ id?: string; error?: string }> {
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[wa] Skipped send — WhatsApp not configured. To:", to, "msg:", JSON.stringify(message).slice(0, 200));
    return { error: "WhatsApp not configured (WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID missing)" };
  }
  const cleanTo = to.replace(/[^\d]/g, "");
  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: cleanTo, ...message }),
      cache: "no-store",
    });
    const data: any = await res.json();
    if (!res.ok) {
      console.error("[wa] send failed", res.status, data);
      return { error: data?.error?.message ?? `HTTP ${res.status}` };
    }
    return { id: data?.messages?.[0]?.id };
  } catch (e: any) {
    console.error("[wa] fetch error", e);
    return { error: e?.message ?? "network error" };
  }
}
