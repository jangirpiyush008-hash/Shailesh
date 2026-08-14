/**
 * Message templates for the SBJ WhatsApp bot.
 * Kept in one place so we can tune tone easily.
 * All copy is short, simple, Hinglish-friendly — target audience is on-site workers.
 */

export const M = {
  accessDenied: () =>
    `❌ Access denied.\n\nApka number is dashboard mein registered nahi hai. Please apne admin se sampark karein — wo apna number Users & Access mein add karenge.`,

  welcome: (name: string) =>
    `Namaste ${name} 👋\n\nSBJ Technical Works ka official bot hai. Aap yahan expense, labour, material sab log kar sakte ho.\n\nKuch bhi bhej do — jaise:\n_"JC415 material 25 sheet 18mm mdf @ 53"_\n\nYa "menu" type karo options ke liye.`,

  mainMenu: () =>
    `📋 *Main Menu*\n\nSelect one:`,

  mainMenuOptions: [
    { id: "menu:add_expense",   title: "➕ Add expense",     description: "Material, labour, food, etc." },
    { id: "menu:my_projects",   title: "📁 My projects",     description: "See projects you're on" },
    { id: "menu:recent",        title: "🕒 Recent entries",  description: "Last 5 you logged" },
    { id: "menu:help",          title: "❓ Help",            description: "How to use this bot" },
  ],

  noProjects: () =>
    `📁 Aap kisi project mein assigned nahi ho abhi.\n\nAdmin se project assign karwayein.`,

  pickProject: () =>
    `📁 Kis project ke liye entry hai?`,

  pickCategory: () =>
    `🏷 Konsi category?`,

  askDescription: () =>
    `📝 Kya cheez? (jaise "18mm MDF" ya "Carpenter")`,

  askQuantity: () =>
    `🔢 Kitni quantity?`,

  askHours: () =>
    `⏱ Total hours kitne? (agar hourly rate hai)\n\nAgar sirf per-day rate hai, "skip" bhejo.`,

  askRate: () =>
    `💰 Rate kya hai per unit? (AED)`,

  askUnit: () =>
    `📏 Unit kya hai?`,

  confirming: (ctx: any, total: number) =>
    `📋 *Confirm entry:*\n\n` +
    `Project: *${ctx.project_code ?? "?"}*\n` +
    `Category: ${ctx.category_name ?? "?"}\n` +
    `Description: ${ctx.description ?? "?"}\n` +
    `Quantity: ${ctx.quantity ?? "?"} ${ctx.unit ?? ""}\n` +
    (ctx.total_hours ? `Hours: ${ctx.total_hours}\n` : "") +
    `Rate: AED ${ctx.unit_price ?? 0}\n` +
    `\n💵 *Total: AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n\n` +
    `Sahi hai?`,

  saved: (ctx: any, total: number) =>
    `✅ *Saved!*\n\n` +
    `${ctx.description} → ${ctx.project_code}\n` +
    `AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
    `Aur kuch add karna hai? Bas bhej do.`,

  cancelled: () =>
    `❌ Cancel kar diya. Kuch aur karna hai? "menu" type karo.`,

  didntUnderstand: (hint?: string) =>
    `🤔 Samajh nahi aaya${hint ? ` (${hint})` : ""}. \n\nPhir se try karo, ya "menu" type karo options ke liye.`,

  askClarify: (missing: string) =>
    `🤔 Ek detail chahiye — *${missing}*\n\nJaldi se bhej do.`,

  otpSent: (otp: string) =>
    `🔐 *Password change*\n\n` +
    `Aapka OTP: *${otp}*\n` +
    `(valid for 10 minutes)\n\n` +
    `Ab apna naya password bhejo — is format mein:\n\n` +
    `*OTP:${otp} newpassword*\n\n` +
    `Example: _OTP:${otp} MyPass2026_\n\n` +
    `❌ Cancel karna hai? Type: cancel`,

  otpInvalid: () =>
    `❌ OTP galat hai ya expire ho gaya.\n\n"reset password" phir se bhejo new OTP ke liye.`,

  passwordTooShort: () =>
    `⚠ Password kam se kam 6 characters ka hona chahiye.\n\nPhir se try karo: *OTP:xxxxxx newpassword*`,

  passwordChanged: () =>
    `✅ *Password changed successfully!*\n\n` +
    `Ab web dashboard mein naye password se login kar sakte ho.\n\n` +
    `Kuch aur karna hai? "menu" bhejo.`,

  helpText: () =>
    `❓ *Kaise use karein:*\n\n` +
    `1. Direct message bhejo:\n   _"JC415 material 25 sheet 18mm mdf @ 53"_\n\n` +
    `2. Ya "menu" type karo — step by step guide milega\n\n` +
    `3. Labour ke liye:\n   _"JC415 on site 12 carpenter 216 hrs @ 12"_\n\n` +
    `4. Vehicle:\n   _"JC415 3ton 2 trip @ 130"_\n\n` +
    `*Commands:*\n` +
    `• menu — main menu\n` +
    `• reset password — change your password\n` +
    `• cancel — abort current entry\n\n` +
    `Bot sab samajh leta hai — Hindi, English, mixed sab chalega 🙌`,

  welcomeCoordinator: (params: { name: string; role: string; email: string; password: string; loginUrl: string; adminName?: string }) =>
    `🎉 *Welcome to SBJ, ${params.name}!*\n\n` +
    `Aapko ${params.adminName ? params.adminName + " ne " : ""}*${params.role === "coordinator" ? "Coordinator" : "Employee"}* ke roop mein add kar diya hai.\n\n` +
    `🔐 *Aapke credentials:*\n` +
    `📧 Email: ${params.email}\n` +
    `🔑 Password: \`${params.password}\`\n\n` +
    `Do tarike se access:\n\n` +
    `1️⃣ *Web dashboard:* ${params.loginUrl}\n` +
    `   (email + password se login karein)\n\n` +
    `2️⃣ *WhatsApp bot (yahi):* seedha message bhejo\n` +
    `   Jaise: _"JC415 material 25 sheet 18mm mdf @ 53"_\n` +
    `   Ya "menu" type karo\n\n` +
    `⚙ Password change karna hai? Type: *reset password*\n` +
    `❓ Help chahiye? Type: *help*`,

  welcomeAdmin: (params: { name: string; email: string; password: string; loginUrl: string; adminName?: string }) =>
    `🎉 *Welcome to SBJ Dashboard, ${params.name}!*\n\n` +
    `Aapko ${params.adminName ? params.adminName + " ne " : ""}*Admin* access diya hai.\n\n` +
    `🌐 *Web Dashboard Login:*\n` +
    `${params.loginUrl}\n\n` +
    `📧 *Email:* ${params.email}\n` +
    `🔑 *Temporary password:* \`${params.password}\`\n\n` +
    `⚠ *Important:* Login karke turant password change kar lena.\n\n` +
    `Aap dashboard se sab kuch manage kar sakte ho: projects, users, expenses, reports. Aur WhatsApp pe bhi entries log kar sakte ho.\n\n` +
    `Coordinator/employee ke har entry ka notification aapko yahi WhatsApp pe milega.`,

  adminNotification: (params: {
    user_name: string;
    project_code: string;
    project_name: string;
    category: string;
    description: string;
    quantity: number;
    unit?: string;
    hours?: number;
    rate: number;
    total: number;
  }) =>
    `🔔 *New entry via WhatsApp*\n\n` +
    `*By:* ${params.user_name}\n` +
    `*Project:* ${params.project_code} (${params.project_name})\n` +
    `*Category:* ${params.category}\n` +
    `*Description:* ${params.description}\n` +
    `*Qty:* ${params.quantity} ${params.unit ?? ""}${params.hours ? ` · Hours: ${params.hours}` : ""}\n` +
    `*Rate:* AED ${params.rate}\n` +
    `*Total:* AED ${params.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
    `Dashboard mein saved ✓`,
};

export const CONFIRM_BUTTONS = [
  { id: "confirm:yes", title: "✅ Save" },
  { id: "confirm:no",  title: "❌ Cancel" },
];
