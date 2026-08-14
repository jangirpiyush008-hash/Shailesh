import { redirect } from "next/navigation";
import Link from "next/link";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { MessageCircle, Check, X, ArrowRight, Users, Server, Bell, KeyRound, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WhatsAppSetupPage() {
  const me = await currentProfile();
  if (!permissions(me).canManageUsers) redirect("/dashboard");

  // Check what's actually configured
  const supabase = createClient();
  const { count: usersWithPhone } = await supabase
    .from("profiles").select("id", { count: "exact", head: true })
    .not("phone_number", "is", null);
  const { count: totalUsers } = await supabase
    .from("profiles").select("id", { count: "exact", head: true });
  const { count: totalMessages } = await supabase
    .from("whatsapp_messages").select("id", { count: "exact", head: true });

  const envReady = {
    accessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId:     !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    openai:      !!process.env.OPENAI_API_KEY,
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
  };
  const allEnvReady = envReady.accessToken && envReady.phoneId && envReady.verifyToken;
  const aiReady = envReady.openai || envReady.anthropic;

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://shailesh-production.up.railway.app"}/api/whatsapp/webhook`;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 grid place-items-center"><MessageCircle size={18} /></div>
          <h1 className="text-2xl font-semibold">WhatsApp Automation — Setup</h1>
        </div>
        <p className="text-sm text-slate-500">
          Coordinators &amp; employees log entries by sending WhatsApp messages to the official SBJ number. Admin (you) approves who's allowed, and gets a notification for every entry.
        </p>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusPill ready={allEnvReady} label="Meta Cloud API" ok="Connected" pending="Env vars pending" />
        <StatusPill ready={aiReady}     label="AI parser"     ok={envReady.openai ? "OpenAI" : "Claude"} pending="No AI key" />
        <StatusPill ready={(usersWithPhone ?? 0) > 0} label="Users with phone" ok={`${usersWithPhone ?? 0} / ${totalUsers ?? 0}`} pending="Add phone numbers" />
        <StatusPill ready={(totalMessages ?? 0) > 0}  label="Messages logged"  ok={`${totalMessages ?? 0} so far`} pending="Waiting for first msg" />
      </div>

      {/* STEP 1 — Meta setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNum n={1} done={allEnvReady} /> Register your Dubai WhatsApp number with Meta
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>Meta gives you a free WhatsApp Business Cloud API tier (1,000 conversations/month included). One-time setup.</p>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-violet-600 hover:underline inline-flex items-center gap-1">developers.facebook.com/apps <ExternalLink size={12} /></a> — create a new app of type <b>Business</b>.</li>
            <li>Add the <b>WhatsApp</b> product to your app. Meta will give you a test number automatically — replace it with your Dubai number in <b>Phone numbers → Add phone number</b>.</li>
            <li>Verify the number via SMS/call — takes ~1 min.</li>
            <li>Copy 3 values to Railway <b>Variables</b>:</li>
          </ol>
          <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-1">
            <div><span className="text-slate-400"># Meta Business Manager → WhatsApp → API Setup</span></div>
            <div>WHATSAPP_ACCESS_TOKEN   = EAAG...<span className="text-slate-500"># permanent token, generate in App → System Users</span></div>
            <div>WHATSAPP_PHONE_NUMBER_ID = 123456789012345<span className="text-slate-500"># under 'From' phone number ID</span></div>
            <div>WHATSAPP_VERIFY_TOKEN   = pick-any-random-string-here</div>
          </div>
          <p>Save → Railway redeploys automatically. Come back here — the "Meta Cloud API" pill above should flip green.</p>
        </CardBody>
      </Card>

      {/* STEP 2 — Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNum n={2} done={allEnvReady} /> Point Meta's webhook at this dashboard
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>In Meta Business Manager → your app → <b>WhatsApp → Configuration → Webhook</b>:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Callback URL</div>
              <div className="rounded-md bg-slate-100 border border-slate-200 px-3 py-2 font-mono text-xs break-all">{webhookUrl}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Verify Token</div>
              <div className="rounded-md bg-slate-100 border border-slate-200 px-3 py-2 font-mono text-xs">Same value as WHATSAPP_VERIFY_TOKEN above</div>
            </div>
          </div>
          <p>Click <b>Verify and Save</b>. Then in the same page → <b>Webhook fields</b> → subscribe to <b><code>messages</code></b>.</p>
        </CardBody>
      </Card>

      {/* STEP 3 — Add AI key (optional but recommended) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNum n={3} done={aiReady} /> Add an AI key (recommended)
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>Coordinators send messy Hinglish. The bot uses AI to understand messages like <i>"jc415 on site 12 carpenter 216 hrs @ 12"</i>. Without an AI key it still works via regex fallback — but it's noticeably weaker.</p>
          <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-1">
            <div><span className="text-slate-400"># Either one is enough — OpenAI is recommended (cheaper, better at Hinglish)</span></div>
            <div>OPENAI_API_KEY = sk-... <span className="text-slate-500"># from platform.openai.com</span></div>
            <div>ANTHROPIC_API_KEY = sk-ant-... <span className="text-slate-500"># from console.anthropic.com</span></div>
          </div>
          <p className="text-xs text-slate-500">Real cost: {"<"} 40 AED/month even for heavy use. GPT-4o-mini charges ~$0.001 per parse.</p>
        </CardBody>
      </Card>

      {/* STEP 4 — Grant access to users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNum n={4} done={(usersWithPhone ?? 0) > 0} /> Grant access to each coordinator / employee
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>The bot <b>only</b> accepts messages from phone numbers you've added. Any random number gets an "Access denied" reply.</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Open <Link href="/users" className="text-violet-600 hover:underline">Users &amp; Access</Link></li>
            <li>Click <b>+ Add user</b></li>
            <li>Fill in <b>Full name</b>, <b>Email</b>, and the <b>WhatsApp phone (with country code)</b> field</li>
            <li>Role = <b>Employee</b> or <b>Coordinator</b> — they will never see the web dashboard, only WhatsApp</li>
            <li>Save. Done — they can now message the SBJ number.</li>
          </ol>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 text-sm">
            <b>Currently registered:</b> {usersWithPhone ?? 0} users with a WhatsApp phone out of {totalUsers ?? 0} total accounts.
            <Link href="/users" className="block mt-1 text-emerald-700 underline">Manage users →</Link>
          </div>
        </CardBody>
      </Card>

      {/* STEP 5 — Assign users to projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNum n={5} done={false} /> Assign each user to their projects
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>When a coordinator asks "which project?" the bot only shows them projects they're assigned to. Zero cross-project leakage.</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Open any project's detail page</li>
            <li>Scroll to <b>Team</b> section (coming next)</li>
            <li>Add coordinator(s) + employee(s) who'll be working on it</li>
          </ol>
          <p className="text-xs text-slate-500">The bot uses the <code>project_team</code> table + the project's <code>coordinator_id</code> to decide who sees what.</p>
        </CardBody>
      </Card>

      {/* How the coordinator uses it */}
      <Card>
        <CardHeader><CardTitle>What the coordinator sees on their phone</CardTitle></CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>Dead simple. They save your SBJ number, then either:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Option A — Send it all in one message</div>
              <div className="font-mono text-xs bg-white rounded p-3 border border-slate-200 mb-2">"JC415 on site 12 carpenter 216 hrs @ 12"</div>
              <div className="text-xs text-slate-600">→ AI parses, bot confirms with a summary, coordinator taps <b>✅ Save</b>.</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Option B — Guided menu</div>
              <div className="font-mono text-xs bg-white rounded p-3 border border-slate-200 mb-2">Type "menu" → tap Add expense → pick project → pick category → answer 3 questions</div>
              <div className="text-xs text-slate-600">→ Use this if the coordinator finds freeform confusing.</div>
            </div>
          </div>
          <p className="text-xs text-slate-500">The AI handles Hinglish, typos, abbreviations. If uncertain, the bot asks a clarifying question instead of guessing.</p>
        </CardBody>
      </Card>

      {/* Admin notification setting */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell size={16} className="text-amber-600" /> Admin notifications</CardTitle></CardHeader>
        <CardBody className="text-sm text-slate-700 space-y-2">
          <p>Every time a coordinator or employee saves an entry via WhatsApp, all admins with a phone number and <code>notify_on_updates = true</code> receive a WhatsApp message like:</p>
          <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded p-3">
            🔔 New entry via WhatsApp<br/>
            By: Manoj Kumar Jangir<br/>
            Project: SBJ-JC-26-415 (Agentic AI stand)<br/>
            Category: Labour<br/>
            Description: On Site — Carpenter<br/>
            Qty: 12 NOS · Hours: 216<br/>
            Rate: AED 12 · Total: AED 2,592.00
          </div>
          <p className="text-xs text-slate-500">Turn off per-admin in Users &amp; Access → their profile.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function StatusPill({ ready, label, ok, pending }: { ready: boolean; label: string; ok: string; pending: string }) {
  return (
    <div className={`rounded-lg border p-3 ${ready ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${ready ? "text-emerald-800" : "text-amber-800"}`}>
        {ready ? <><Check size={14} className="inline mr-1" />{ok}</> : <><X size={14} className="inline mr-1" />{pending}</>}
      </div>
    </div>
  );
}

function StepNum({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${done ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
      {done ? <Check size={12} /> : n}
    </span>
  );
}
