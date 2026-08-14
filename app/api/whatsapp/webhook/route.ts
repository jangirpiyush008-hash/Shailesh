import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText, sendList, sendButtons, isWhatsAppConfigured } from "@/lib/whatsapp/messenger";
import { parseExpenseMessage, type ParsedExpense } from "@/lib/whatsapp/parser";
import { getOrCreateSession, updateSession, resetSession, logMessage, type WASession } from "@/lib/whatsapp/session";
import { M, CONFIRM_BUTTONS } from "@/lib/whatsapp/menu";
import { notifyAdminsOfEntry } from "@/lib/whatsapp/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =====================================================================
 * GET /api/whatsapp/webhook — Meta verification handshake
 * ===================================================================== */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/* =====================================================================
 * POST /api/whatsapp/webhook — incoming messages
 * ===================================================================== */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  try {
    const entries = body.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        for (const msg of messages) {
          await handleIncomingMessage(msg, value);
        }
      }
    }
  } catch (e) {
    console.error("[wa webhook] handler error", e);
  }
  // ALWAYS respond 200 to Meta or they'll retry
  return NextResponse.json({ ok: true });
}

/* =====================================================================
 * Message handler
 * ===================================================================== */
async function handleIncomingMessage(msg: any, ctx: any): Promise<void> {
  const from = msg.from as string;                    // sender phone (E.164 without +)
  const phone = "+" + from.replace(/^\+?/, "");
  const wa_message_id = msg.id;

  // Extract plain text (handles text + interactive replies)
  let bodyText = "";
  let interactive_id = "";
  if (msg.type === "text") bodyText = msg.text?.body ?? "";
  else if (msg.type === "interactive") {
    const r = msg.interactive?.list_reply ?? msg.interactive?.button_reply;
    interactive_id = r?.id ?? "";
    bodyText = r?.title ?? "";
  } else if (msg.type === "button") {
    interactive_id = msg.button?.payload ?? "";
    bodyText = msg.button?.text ?? "";
  } else {
    // Unsupported message type (image, sticker, etc.) — polite reply
    await reply(phone, `Sorry — abhi sirf text/menu buttons handle karta hu. "menu" bhejo.`, null, "unsupported_type");
    return;
  }

  // Look up profile from phone
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role, access_level, phone_number")
    .eq("phone_number", phone)
    .maybeSingle();

  // Log the inbound
  await logMessage({
    direction: "inbound",
    phone_number: phone,
    profile_id: profile?.id ?? null,
    wa_message_id,
    body: bodyText,
    parsed_intent: interactive_id || null,
    meta: { type: msg.type, interactive_id },
  });

  // 🚫 Access denied for unknown numbers (admin has NOT added them)
  if (!profile) {
    await reply(phone, M.accessDenied(), null, "access_denied");
    return;
  }

  // Load session
  const session = await getOrCreateSession(phone, profile.id);

  // Global commands (override any state)
  const low = bodyText.trim().toLowerCase();
  if (low === "menu" || low === "hi" || low === "hello" || low === "start" || low === "namaste") {
    return showMainMenu(phone, profile);
  }
  if (low === "cancel" || low === "exit") {
    await resetSession(phone);
    return reply(phone, M.cancelled(), profile.id, "cancelled");
  }
  if (low === "help" || low === "?") {
    return reply(phone, M.helpText(), profile.id, "help");
  }
  if (low === "reset password" || low === "change password" || low === "reset" || low === "password change") {
    return startPasswordReset(phone, profile);
  }

  // Password-reset in progress? Check for OTP pattern in the message
  if (session.state === "awaiting_otp_password") {
    return handleOtpReply(phone, profile, bodyText, session);
  }

  // Route by interactive_id (button/list reply) or by session state
  if (interactive_id.startsWith("menu:")) {
    return handleMenuChoice(phone, profile, interactive_id, session);
  }
  if (interactive_id.startsWith("proj:")) {
    return handleProjectPick(phone, profile, interactive_id, session);
  }
  if (interactive_id.startsWith("cat:")) {
    return handleCategoryPick(phone, profile, interactive_id, session);
  }
  if (interactive_id === "confirm:yes") return handleSave(phone, profile, session);
  if (interactive_id === "confirm:no")  { await resetSession(phone); return reply(phone, M.cancelled(), profile.id, "cancelled"); }

  // Otherwise: freeform text → try to parse as an expense directly
  return handleFreeformText(phone, profile, bodyText, session);
}

/* =====================================================================
 * State handlers
 * ===================================================================== */

async function showMainMenu(phone: string, profile: any): Promise<void> {
  await resetSession(phone);
  const first = profile.full_name?.split(" ")[0] ?? "there";
  await reply(phone, M.welcome(first), profile.id, "welcome");
  const res = await sendList(phone, {
    body: M.mainMenu(),
    buttonText: "Choose",
    sectionTitle: "Actions",
    rows: M.mainMenuOptions,
  });
  await logMessage({
    direction: "outbound", phone_number: phone, profile_id: profile.id,
    wa_message_id: res.id, body: "MENU", parsed_intent: "main_menu",
    meta: { error: res.error },
  });
}

async function handleMenuChoice(phone: string, profile: any, id: string, _session: WASession): Promise<void> {
  const choice = id.split(":")[1];
  if (choice === "add_expense") {
    return startProjectPick(phone, profile);
  }
  if (choice === "my_projects") {
    return listMyProjects(phone, profile);
  }
  if (choice === "recent") {
    return showRecent(phone, profile);
  }
  if (choice === "help") {
    return reply(phone, M.helpText(), profile.id, "help");
  }
}

async function startProjectPick(phone: string, profile: any): Promise<void> {
  const admin = createAdminClient();
  const { data: projects } = await admin.rpc("wa_projects_for", { p_user_id: profile.id });
  if (!projects?.length) {
    return reply(phone, M.noProjects(), profile.id, "no_projects");
  }
  await updateSession(phone, { state: "picking_project", context: {} });
  const rows = projects.slice(0, 10).map((p: any) => ({
    id: `proj:${p.id}`,
    title: p.job_card_number,
    description: `${p.project_name} · ${p.client_name}`.slice(0, 72),
  }));
  const res = await sendList(phone, {
    header: "Pick project",
    body: M.pickProject(),
    buttonText: "Projects",
    sectionTitle: "Your projects",
    rows,
  });
  await logMessage({ direction: "outbound", phone_number: phone, profile_id: profile.id, wa_message_id: res.id, body: "PICK_PROJECT", parsed_intent: "picking_project", meta: { error: res.error } });
}

async function handleProjectPick(phone: string, profile: any, id: string, session: WASession): Promise<void> {
  const projectId = id.split(":")[1];
  const admin = createAdminClient();
  const { data: proj } = await admin.from("projects").select("id, job_card_number, project_name").eq("id", projectId).single();
  if (!proj) return reply(phone, "Project not found — try again.", profile.id, "proj_not_found");

  const ctx = { ...session.context, project_id: proj.id, project_code: proj.job_card_number, project_name: proj.project_name };
  await updateSession(phone, { state: "picking_category", context: ctx });
  return showCategoryPicker(phone, profile);
}

async function showCategoryPicker(phone: string, profile: any): Promise<void> {
  const admin = createAdminClient();
  const { data: cats } = await admin.from("expense_categories").select("id, name, side").eq("is_active", true).order("side").order("sort_order");
  if (!cats?.length) return reply(phone, "No categories set up — contact admin.", profile.id, "no_cats");
  const rows = cats.slice(0, 10).map((c) => ({ id: `cat:${c.id}`, title: c.name, description: c.side === "right" ? "Labour side" : "Materials side" }));
  const res = await sendList(phone, { body: M.pickCategory(), buttonText: "Categories", sectionTitle: "Categories", rows });
  await logMessage({ direction: "outbound", phone_number: phone, profile_id: profile.id, wa_message_id: res.id, body: "PICK_CATEGORY", parsed_intent: "picking_category", meta: { error: res.error } });
}

async function handleCategoryPick(phone: string, profile: any, id: string, session: WASession): Promise<void> {
  const catId = id.split(":")[1];
  const admin = createAdminClient();
  const { data: cat } = await admin.from("expense_categories").select("id, name, side").eq("id", catId).single();
  if (!cat) return reply(phone, "Category not found.", profile.id, "cat_not_found");

  const ctx = { ...session.context, category_id: cat.id, category_name: cat.name, side: cat.side };
  await updateSession(phone, { state: "entering_description", context: ctx });
  return reply(phone, M.askDescription(), profile.id, "ask_description");
}

/* -------- Freeform text handler -------- */
async function handleFreeformText(phone: string, profile: any, text: string, session: WASession): Promise<void> {
  const ctx = session.context ?? {};

  // If mid-flow, treat text as the answer to the current question
  if (session.state === "entering_description") {
    ctx.description = text.trim();
    await updateSession(phone, { state: "entering_quantity", context: ctx });
    return reply(phone, M.askQuantity(), profile.id, "ask_quantity");
  }
  if (session.state === "entering_quantity") {
    const q = Number(text.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(q) || q <= 0) return reply(phone, "Number bhejo (jaise 25).", profile.id, "invalid_qty");
    ctx.quantity = q;
    // Ask hours if labour side
    if (ctx.side === "right") {
      await updateSession(phone, { state: "entering_hours", context: ctx });
      return reply(phone, M.askHours(), profile.id, "ask_hours");
    }
    await updateSession(phone, { state: "entering_rate", context: ctx });
    return reply(phone, M.askRate(), profile.id, "ask_rate");
  }
  if (session.state === "entering_hours") {
    if (text.trim().toLowerCase() === "skip") {
      ctx.total_hours = null;
    } else {
      const h = Number(text.replace(/[^\d.]/g, ""));
      if (Number.isFinite(h) && h > 0) ctx.total_hours = h;
    }
    await updateSession(phone, { state: "entering_rate", context: ctx });
    return reply(phone, M.askRate(), profile.id, "ask_rate");
  }
  if (session.state === "entering_rate") {
    const r = Number(text.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(r) || r < 0) return reply(phone, "Rate bhejo (jaise 53).", profile.id, "invalid_rate");
    ctx.unit_price = r;
    if (!ctx.unit) ctx.unit = ctx.side === "right" ? "NOS" : "Sheet";
    return showConfirm(phone, profile, ctx);
  }

  // Otherwise — treat as a full natural-language attempt
  const parsed = await parseExpenseMessage(text);
  return handleParsedFreeform(phone, profile, parsed, text);
}

/** Take AI/regex parse of a freeform message and either:
 *  - Save immediately if all fields are present + high confidence
 *  - Ask 1-2 clarifying questions to fill gaps
 *  - Show main menu if nothing parseable
 */
async function handleParsedFreeform(phone: string, profile: any, p: ParsedExpense, original: string): Promise<void> {
  // Nothing usable
  if (p.confidence < 0.15 && !p.project_code && !p.description) {
    return reply(phone, M.didntUnderstand("try 'menu' or example: 'JC415 material 25 sheet 18mm mdf @ 53'"), profile.id, "unparseable");
  }

  const admin = createAdminClient();

  // 1) Resolve project by code (partial match)
  let projectId: string | null = null;
  let projectCode = "";
  let projectName = "";
  if (p.project_code) {
    const codeNorm = p.project_code.replace(/[^A-Z0-9]/g, "");
    const { data: projects } = await admin.rpc("wa_projects_for", { p_user_id: profile.id });
    const match = (projects ?? []).find((pr: any) =>
      pr.job_card_number.replace(/[^A-Z0-9]/g, "").toUpperCase().endsWith(codeNorm)
    );
    if (match) { projectId = match.id; projectCode = match.job_card_number; projectName = match.project_name; }
  }
  if (!projectId) {
    // Save what we have so far and ask them to pick a project
    await updateSession(phone, {
      state: "picking_project",
      context: {
        _preparsed: p,          // remember what they said so we can pre-fill when they pick a project
        description: p.description,
        quantity: p.quantity,
        total_hours: p.total_hours,
        unit_price: p.unit_price,
        unit: p.unit,
        side: p.side,
        category_name: p.category,
      },
    });
    return startProjectPick(phone, profile);
  }

  // 2) Resolve category if given
  let categoryId: string | null = null;
  let categoryName = p.category ?? "";
  let side: "left" | "right" | undefined = p.side;
  if (categoryName) {
    const { data: cats } = await admin.from("expense_categories").select("id, name, side").eq("is_active", true);
    const match = cats?.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    if (match) { categoryId = match.id; categoryName = match.name; side = match.side as any; }
  }

  // 3) Build description with labour location prefix if applicable
  let description = p.description ?? "";
  if (side === "right" && p.location && !description.toLowerCase().startsWith(p.location.toLowerCase())) {
    description = `${p.location} — ${description}`.trim();
  }

  const ctx: any = {
    project_id: projectId, project_code: projectCode, project_name: projectName,
    category_id: categoryId, category_name: categoryName, side,
    description, unit: p.unit,
    quantity: p.quantity, total_hours: p.total_hours, unit_price: p.unit_price,
    vendor: p.vendor,
  };

  // 4) Check what's missing → ask 1 clarifying question
  if (!ctx.category_name) {
    await updateSession(phone, { state: "picking_category", context: ctx });
    return showCategoryPicker(phone, profile);
  }
  if (!ctx.description) { await updateSession(phone, { state: "entering_description", context: ctx }); return reply(phone, M.askDescription(), profile.id, "ask_description"); }
  if (!ctx.quantity)    { await updateSession(phone, { state: "entering_quantity",    context: ctx }); return reply(phone, M.askQuantity(),    profile.id, "ask_quantity"); }
  if (ctx.unit_price == null) {
    await updateSession(phone, { state: "entering_rate", context: ctx });
    return reply(phone, M.askRate(), profile.id, "ask_rate");
  }

  return showConfirm(phone, profile, ctx);
}

async function showConfirm(phone: string, profile: any, ctx: any): Promise<void> {
  const total = (ctx.side === "right" && ctx.total_hours && ctx.total_hours > 0)
    ? (ctx.total_hours * ctx.unit_price)
    : ((ctx.quantity ?? 0) * (ctx.unit_price ?? 0));
  await updateSession(phone, { state: "confirming", context: { ...ctx, _total: total } });
  const res = await sendButtons(phone, {
    body: M.confirming(ctx, total),
    buttons: CONFIRM_BUTTONS,
  });
  await logMessage({ direction: "outbound", phone_number: phone, profile_id: profile.id, wa_message_id: res.id, body: "CONFIRM", parsed_intent: "confirming", meta: { total, error: res.error } });
}

async function handleSave(phone: string, profile: any, session: WASession): Promise<void> {
  const ctx = session.context ?? {};
  const total = ctx._total ?? ((ctx.total_hours && ctx.total_hours > 0)
    ? ctx.total_hours * ctx.unit_price
    : (ctx.quantity ?? 0) * (ctx.unit_price ?? 0));

  if (!ctx.project_id || !ctx.category_id || !ctx.description) {
    await resetSession(phone);
    return reply(phone, "Kuch missing tha — dobara try karo.", profile.id, "save_missing_fields");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("expenses").insert({
    project_id: ctx.project_id,
    category_id: ctx.category_id,
    category_name: ctx.category_name,
    side: ctx.side,
    entry_date: new Date().toISOString().slice(0, 10),
    description: ctx.description,
    vendor: ctx.vendor ?? null,
    unit: ctx.unit,
    quantity: ctx.quantity,
    total_hours: ctx.total_hours ?? null,
    unit_price: ctx.unit_price,
    added_by: profile.id,
  });

  if (error) {
    console.error("[wa save]", error);
    return reply(phone, `❌ Save fail: ${error.message}`, profile.id, "save_failed");
  }

  // Activity log
  await admin.from("activity_log").insert({
    project_id: ctx.project_id, user_id: profile.id,
    action: "expense.added.whatsapp",
    entity_type: "expense",
    meta: { side: ctx.side, category: ctx.category_name, description: ctx.description, via: "whatsapp" },
  });

  // Ping admins
  await notifyAdminsOfEntry({
    actor_name: profile.full_name ?? phone,
    project_code: ctx.project_code,
    project_name: ctx.project_name,
    category: ctx.category_name,
    description: ctx.description,
    quantity: ctx.quantity,
    unit: ctx.unit,
    hours: ctx.total_hours,
    rate: ctx.unit_price,
    total,
    exclude_phone: phone,
  });

  await resetSession(phone);
  return reply(phone, M.saved(ctx, total), profile.id, "saved");
}

async function listMyProjects(phone: string, profile: any): Promise<void> {
  const admin = createAdminClient();
  const { data: projects } = await admin.rpc("wa_projects_for", { p_user_id: profile.id });
  if (!projects?.length) return reply(phone, M.noProjects(), profile.id, "no_projects");
  const list = projects.slice(0, 15).map((p: any, i: number) => `${i + 1}. *${p.job_card_number}* — ${p.project_name}`).join("\n");
  return reply(phone, `📁 *Aapke projects:*\n\n${list}\n\n(${projects.length} total)`, profile.id, "listed_projects");
}

async function showRecent(phone: string, profile: any): Promise<void> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("expenses")
    .select("entry_date, description, quantity, unit, unit_price, amount, project:project_id(job_card_number)")
    .eq("added_by", profile.id)
    .order("created_at", { ascending: false }).limit(5);
  if (!rows?.length) return reply(phone, "Abhi tak koi entry nahi hai.", profile.id, "no_recent");
  const list = rows.map((r: any, i: number) =>
    `${i + 1}. ${r.project?.job_card_number ?? "?"} · ${r.description} · ${r.quantity} ${r.unit ?? ""} @ ${r.unit_price} = AED ${Number(r.amount).toFixed(2)}`
  ).join("\n");
  return reply(phone, `🕒 *Recent 5:*\n\n${list}`, profile.id, "recent");
}

/* =====================================================================
 * Password reset via OTP
 * ===================================================================== */

async function startPasswordReset(phone: string, profile: any): Promise<void> {
  const otp = String(Math.floor(100000 + Math.random() * 900000));  // 6-digit
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min TTL
  await updateSession(phone, {
    state: "awaiting_otp_password",
    context: { otp, otp_expires: expires, intent: "change_password" },
  });
  await reply(phone, M.otpSent(otp), profile.id, "otp_sent");
}

async function handleOtpReply(phone: string, profile: any, text: string, session: WASession): Promise<void> {
  const ctx = session.context ?? {};
  // Expected format: "OTP:123456 newpassword"
  const match = text.match(/OTP\s*:?\s*(\d{6})\s+(\S{6,})/i);
  if (!match) {
    return reply(phone, M.otpInvalid(), profile.id, "otp_invalid_format");
  }
  const [_, sent, newPassword] = match;
  if (sent !== ctx.otp) return reply(phone, M.otpInvalid(), profile.id, "otp_mismatch");
  if (new Date(ctx.otp_expires) < new Date()) return reply(phone, M.otpInvalid(), profile.id, "otp_expired");
  if (newPassword.length < 6) return reply(phone, M.passwordTooShort(), profile.id, "otp_password_short");

  // Update password via Supabase admin API
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (error) {
    console.error("[wa otp] password update failed", error);
    return reply(phone, `❌ Password update fail: ${error.message}`, profile.id, "otp_update_failed");
  }

  await resetSession(phone);
  await reply(phone, M.passwordChanged(), profile.id, "password_changed");
}

/* -------- Small helper -------- */
async function reply(phone: string, body: string, profileId: string | null, intent: string): Promise<void> {
  const res = await sendText(phone, body);
  await logMessage({
    direction: "outbound", phone_number: phone, profile_id: profileId,
    wa_message_id: res.id, body, parsed_intent: intent, meta: { error: res.error },
  });
}
