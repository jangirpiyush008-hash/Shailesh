import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { MessageCircle, Smartphone, Sparkles, Database, Check, Send, Clock, Zap, Phone, Mail, Copy, Users } from "lucide-react";

function Users2Icon() { return <Users size={16} className="text-emerald-600" />; }

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const me = await currentProfile();
  if (!permissions(me).canManageUsers) redirect("/dashboard");

  const officialNumber = "+971 50 511 8431";

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-8 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold mb-3">
              <Sparkles size={12} /> Coming in Phase 2.5
            </div>
            <h1 className="text-3xl font-bold mb-2">WhatsApp Automation</h1>
            <p className="text-emerald-50 max-w-2xl">
              Coordinators and employees log expenses by sending a WhatsApp message to the official SBJ number. AI reads the message, extracts the details, and saves the entry to the right project automatically — no dashboard needed.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 min-w-[200px]">
            <div className="text-xs text-emerald-100 mb-1">Official SBJ WhatsApp</div>
            <div className="text-lg font-semibold font-mono tracking-tight">{officialNumber}</div>
            <div className="text-xs text-emerald-100 mt-1">Same number used for reports</div>
          </div>
        </div>
      </div>

      {/* How it works — 5 step flow */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap size={16} className="text-emerald-600" /> How the automation works</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Step n={1} icon={Smartphone} title="Coordinator/employee messages" desc="Sends a WhatsApp message to the SBJ number from the site or workshop." accent="emerald" />
            <Step n={2} icon={Send} title="Bot receives via Meta API" desc="Message hits our webhook through Meta WhatsApp Business Cloud API." accent="teal" />
            <Step n={3} icon={Sparkles} title="AI parses the message" desc="OpenAI/Claude extracts project code, category, description, qty, unit, rate — in English or Hinglish." accent="violet" />
            <Step n={4} icon={Database} title="Auto-saves to dashboard" desc="Row added to the correct project's Materials or Labour tab. Totals recalculate live." accent="rose" />
            <Step n={5} icon={Check} title="Confirmation reply sent" desc="Bot replies with ✅ and the calculated amount. If unclear, asks a follow-up." accent="amber" />
          </div>
        </CardBody>
      </Card>

      {/* How it scales — one number, everyone */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users2Icon /> How it scales — one number for the whole team</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            {/* Visual diagram (left) */}
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50 border border-slate-200 p-6">
              <div className="flex flex-col items-center gap-4">
                {/* Top: many senders */}
                <div className="grid grid-cols-6 gap-2 w-full max-w-md">
                  {["👷", "👷", "👷", "🧑‍🔧", "👷", "🧑‍🔧", "👷", "🧑‍🔧", "👷", "👷", "🧑‍🔧", "👷"].map((e, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-white border border-slate-200 grid place-items-center text-lg shadow-sm">{e}</div>
                  ))}
                </div>
                <div className="text-xs text-slate-500 -mt-2">100 coordinators + 10 employees on site</div>

                {/* Arrows down */}
                <div className="text-slate-400 text-2xl">↓ ↓ ↓ ↓</div>

                {/* Middle: single WhatsApp number */}
                <div className="bg-emerald-500 text-white rounded-2xl px-6 py-4 shadow-lg flex items-center gap-3 min-w-[280px]">
                  <MessageCircle size={24} />
                  <div>
                    <div className="text-xs opacity-90">Official SBJ WhatsApp</div>
                    <div className="font-bold font-mono">+971 50 511 8431</div>
                  </div>
                </div>

                {/* Arrow down */}
                <div className="text-slate-400 text-2xl">↓</div>

                {/* Bot processing */}
                <div className="bg-violet-100 text-violet-700 rounded-xl px-5 py-3 flex items-center gap-2 border border-violet-300">
                  <Sparkles size={16} /> AI Bot parses each message
                </div>

                {/* Arrow down */}
                <div className="text-slate-400 text-2xl">↓</div>

                {/* Dashboard */}
                <div className="bg-white border-2 border-slate-300 rounded-xl px-6 py-4 shadow-md flex items-center gap-3 min-w-[280px]">
                  <Database size={20} className="text-slate-700" />
                  <div>
                    <div className="text-xs text-slate-500">Central JobCard Dashboard</div>
                    <div className="font-bold text-slate-900">All entries auto-filled ✓</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation (right) */}
            <div className="space-y-4">
              <ScalePoint
                icon="📞"
                title="One WhatsApp number, unlimited senders"
                desc="All 100 coordinators and 10 employees send to the same SBJ WhatsApp Business number. There's no per-user WhatsApp account to manage — just one central number owned by SBJ."
              />
              <ScalePoint
                icon="🔐"
                title="Bot knows WHO sent each message"
                desc="Every user in Users & Access has their phone number saved on their profile. When a message arrives, the bot matches the sender's phone to a profile, so it knows the role (coordinator/employee) and permissions."
              />
              <ScalePoint
                icon="🎯"
                title="Message routes to the RIGHT project"
                desc="The sender includes a short project code in their message (e.g. 'JC415', 'jc26-415', 'Rain Light job'). The AI matches it to the correct Job Card and adds the entry there. If ambiguous, the bot asks: 'Did you mean SBJ-JC-26-415 or SBJ-JC-26-217?'"
              />
              <ScalePoint
                icon="⚡"
                title="Zero login, zero training"
                desc="Employees on-site just open WhatsApp (already installed on every phone) and type. No app to download, no password to remember, no coordinator needed to explain the dashboard. Works on any phone in India, UAE, wherever."
              />
              <ScalePoint
                icon="📊"
                title="Everything lands in one dashboard"
                desc="Admin sees every entry in real time from all 110 people in the Dashboard, Materials, Labour tabs. Each row is stamped with the sender's name — full audit trail of who logged what."
              />
              <ScalePoint
                icon="🚫"
                title="Access rules still apply"
                desc="If an employee tries to log an expense on a project they're not assigned to, the bot politely refuses. If a Read-only coordinator tries to add, same thing. WhatsApp becomes a channel — permissions stay in charge."
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* A day in the life */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardHeader><CardTitle>A typical day, with the bot live</CardTitle></CardHeader>
        <CardBody>
          <div className="space-y-3">
            <TimelineRow time="08:30" who="Carpenter on site" msg="JC415 - 25 sheets 18mm mdf @ 53 from danube" result="✅ Saved AED 1,325 to SBJ-JC-26-415" />
            <TimelineRow time="10:45" who="Coordinator Manoj" msg="JC415 on site 12 carpenters 216 hrs" result="✅ Saved 12 × 216 hrs to Labour" />
            <TimelineRow time="12:15" who="Employee at workshop" msg="jc415 breakfast 16 nos 6 aed each" result="✅ Saved AED 96 (Food, workshop)" />
            <TimelineRow time="14:22" who="Driver" msg="jc415 3ton 37652 - 2 trips 130 aed" result="✅ Saved AED 260 (Vehicle)" />
            <TimelineRow time="16:00" who="Another coordinator" msg="jc217 primer 1 drum 450" result="✅ Saved AED 450 to SBJ-JC-26-217" />
            <TimelineRow time="17:30" who="Admin (dashboard)" msg="Opens JobCard Pro" result="Sees ALL entries filled live — hits Export Excel ✓" />
          </div>
        </CardBody>
      </Card>

      {/* Example messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">✍ Example — coordinator sends</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <div className="text-xs text-emerald-600 font-semibold mb-1">From coordinator</div>
              <div className="text-slate-900">
                <b>JC415</b> material 25 sheets of 18mm MDF at 53 each from Danube
              </div>
            </div>
            <div className="text-center text-slate-400 text-xs">↓ AI extracts ↓</div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono space-y-1">
              <div><span className="text-slate-500">project:</span> SBJ-JC-26-415</div>
              <div><span className="text-slate-500">side:</span> materials</div>
              <div><span className="text-slate-500">category:</span> Material</div>
              <div><span className="text-slate-500">description:</span> 18mm MDF</div>
              <div><span className="text-slate-500">unit:</span> Sheet</div>
              <div><span className="text-slate-500">quantity:</span> 25</div>
              <div><span className="text-slate-500">unit_rate:</span> 53</div>
              <div><span className="text-slate-500">vendor:</span> Danube</div>
              <div><span className="text-slate-500">total:</span> AED 1,325.00</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <div className="text-xs text-emerald-600 font-semibold mb-1">Bot replies</div>
              <div className="text-slate-900">✅ Saved AED 1,325.00 to <b>SBJ-JC-26-415</b> — 25 sheets 18mm MDF @ 53. Materials total now AED 4,213.00.</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">🛠 Example — employee logs labour</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <div className="text-xs text-emerald-600 font-semibold mb-1">From employee</div>
              <div className="text-slate-900">
                JC415 on site 12 carpenters ne 216 hrs kaam kiya
              </div>
            </div>
            <div className="text-center text-slate-400 text-xs">↓ AI extracts (Hinglish OK) ↓</div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono space-y-1">
              <div><span className="text-slate-500">project:</span> SBJ-JC-26-415</div>
              <div><span className="text-slate-500">side:</span> labour</div>
              <div><span className="text-slate-500">category:</span> Labour</div>
              <div><span className="text-slate-500">description:</span> On Site — Carpenter</div>
              <div><span className="text-slate-500">unit:</span> NOS</div>
              <div><span className="text-slate-500">quantity:</span> 12</div>
              <div><span className="text-slate-500">total_hours:</span> 216</div>
              <div><span className="text-slate-500">unit_rate:</span> <i>(needs admin/coord)</i></div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="text-xs text-amber-700 font-semibold mb-1">Employee ↔ bot</div>
              <div className="text-slate-900">✅ Saved 12 Carpenters × 216 hours to SBJ-JC-26-415 (labour). Admin will fill in the rate.</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* What we need to build */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock size={16} className="text-amber-600" /> Setup required to go live</CardTitle></CardHeader>
        <CardBody className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SetupItem
              title="1. Meta WhatsApp Business Cloud API"
              desc="Register the SBJ number as a WhatsApp Business number via developers.facebook.com. Free tier: 1,000 conversations/month."
              status="Not started"
            />
            <SetupItem
              title="2. Webhook + phone number mapping"
              desc="Deploy /api/whatsapp/webhook (Railway will host it). Add each coordinator/employee's phone number to their profile so the bot knows who's sending."
              status="Not started"
            />
            <SetupItem
              title="3. AI parser (OpenAI or Claude)"
              desc="Extract structured expense from freeform text. Supports Hindi/Hinglish, unit synonyms (sheet=NOS), and short forms (JC415 → SBJ-JC-26-415)."
              status="Ready — keys already in Railway ✓"
            />
            <SetupItem
              title="4. Confirmation replies + retries"
              desc="Bot confirms every save. If AI can't parse, sends a clarifying question. Rate limiting + spam protection."
              status="Not started"
            />
          </div>
        </CardBody>
      </Card>

      {/* Cost + rollout plan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-emerald-600">FREE</div>
            <div className="text-sm text-slate-600 mt-1">First 1,000 messages/month</div>
            <div className="text-xs text-slate-500 mt-2">Meta's free tier covers SBJ's typical usage</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-slate-900">~7 days</div>
            <div className="text-sm text-slate-600 mt-1">Implementation time</div>
            <div className="text-xs text-slate-500 mt-2">Meta approval takes 2-3 days, coding 3-4 days</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-violet-600">80%</div>
            <div className="text-sm text-slate-600 mt-1">Faster entry vs dashboard</div>
            <div className="text-xs text-slate-500 mt-2">One message vs 8 form fields + submit</div>
          </CardBody>
        </Card>
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-slate-50 to-emerald-50 border-emerald-200">
        <CardBody className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold text-slate-900">Ready to enable this?</div>
            <div className="text-sm text-slate-600 mt-0.5">
              Message us when you've registered the Meta WhatsApp Business number — we'll wire the webhook and go live within a day.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled className="opacity-60 cursor-not-allowed">
              <Phone size={14} /> Not enabled yet
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* -------------------- helpers -------------------- */
function Step({ n, icon: Icon, title, desc, accent }: any) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    teal:    "bg-teal-50    text-teal-700    border-teal-200",
    violet:  "bg-violet-50  text-violet-700  border-violet-200",
    rose:    "bg-rose-50    text-rose-700    border-rose-200",
    amber:   "bg-amber-50   text-amber-700   border-amber-200",
  }[accent as string] ?? "bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border-2 p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-white grid place-items-center font-bold text-sm">{n}</div>
        <Icon size={16} />
      </div>
      <div className="font-semibold text-sm text-slate-900 mb-1">{title}</div>
      <div className="text-xs text-slate-600 leading-snug">{desc}</div>
    </div>
  );
}

function ScalePoint({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-2xl shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-sm text-slate-900 mb-0.5">{title}</div>
        <div className="text-sm text-slate-600 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

function TimelineRow({ time, who, msg, result }: { time: string; who: string; msg: string; result: string }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-emerald-100 last:border-0">
      <div className="font-mono text-xs text-slate-500 pt-0.5 w-14 shrink-0">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{who}</div>
        <div className="text-sm text-slate-800 font-mono bg-white/60 rounded px-2 py-1 mt-0.5 inline-block">"{msg}"</div>
      </div>
      <div className="text-xs text-emerald-700 font-semibold pt-1 max-w-[240px] text-right">{result}</div>
    </div>
  );
}

function SetupItem({ title, desc, status }: { title: string; desc: string; status: string }) {
  const isDone = status.includes("Ready") || status.includes("✓");
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
      <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${isDone ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
        {isDone ? <Check size={14} /> : <Clock size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900">{title}</div>
        <div className="text-xs text-slate-600 mt-0.5">{desc}</div>
        <div className={`text-[11px] font-semibold mt-1.5 ${isDone ? "text-emerald-700" : "text-slate-500"}`}>{status}</div>
      </div>
    </div>
  );
}
