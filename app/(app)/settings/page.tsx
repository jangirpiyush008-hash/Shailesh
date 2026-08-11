import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Key, Sparkles, Presentation, Bot, Database } from "lucide-react";

export const dynamic = "force-dynamic";

type Integration = {
  name: string;
  desc: string;
  key: string;
  icon: typeof Presentation;
  value?: string;
};

function maskKey(v: string | undefined): string {
  if (!v) return "";
  if (v.length <= 12) return "•".repeat(v.length);
  return `${v.slice(0, 6)}${"•".repeat(Math.max(4, v.length - 12))}${v.slice(-4)}`;
}

export default function SettingsPage() {
  // Server component — reads directly from Railway env at request time
  const integrations: Integration[] = [
    { name: "Gamma API",       desc: "Auto-generate presentations from project data.", key: "GAMMA_API_KEY",     icon: Presentation, value: process.env.GAMMA_API_KEY },
    { name: "OpenAI",          desc: "AI slide content, executive summaries, insights.", key: "OPENAI_API_KEY",  icon: Sparkles,     value: process.env.OPENAI_API_KEY },
    { name: "Anthropic Claude",desc: "Long-doc analysis and content generation.",       key: "ANTHROPIC_API_KEY", icon: Bot,         value: process.env.ANTHROPIC_API_KEY },
    { name: "Google Gemini",   desc: "Multimodal analysis of uploaded files.",          key: "GEMINI_API_KEY",   icon: Bot,          value: process.env.GEMINI_API_KEY },
    { name: "Supabase (admin)",desc: "Service-role key for server-side admin operations.", key: "SUPABASE_SERVICE_ROLE_KEY", icon: Database, value: process.env.SUPABASE_SERVICE_ROLE_KEY },
  ];

  const connectedCount = integrations.filter((i) => !!i.value).length;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          {connectedCount} of {integrations.length} integrations connected. Keys are set in <b>Railway → Variables</b> (or <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">.env.local</code> for dev). A UI-based key manager ships in Phase 2.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Key size={18} /> Integrations</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          {integrations.map((i) => {
            const Icon = i.icon;
            const isConnected = Boolean(i.value);
            return (
              <div key={i.key} className="flex items-start gap-4 p-4 rounded-lg border border-slate-200">
                <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${isConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{i.name}</div>
                    {isConnected
                      ? <Badge variant="success">Connected</Badge>
                      : <Badge variant="warning">Not configured</Badge>}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">{i.desc}</div>
                  <div className="mt-2 text-xs font-mono text-slate-400 flex items-center gap-3 flex-wrap">
                    <span>Env var: {i.key}</span>
                    {isConnected && <span className="text-emerald-600">Value: {maskKey(i.value)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Company header</CardTitle></CardHeader>
        <CardBody className="text-sm text-slate-600">
          <div className="space-y-1">
            <div><b className="text-slate-900">Name:</b> {process.env.COMPANY_NAME || "(default) SBJ Technical Works LLC"}</div>
            <div><b className="text-slate-900">Address:</b> {process.env.COMPANY_ADDRESS || "(default) Dubai Industrial City"}</div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Change these via <code className="bg-slate-100 px-1.5 py-0.5 rounded">COMPANY_NAME</code> and <code className="bg-slate-100 px-1.5 py-0.5 rounded">COMPANY_ADDRESS</code> in Railway Variables. They appear at the top of every exported Job Card.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Supabase (public)</CardTitle></CardHeader>
        <CardBody className="text-sm text-slate-600">
          <div className="space-y-1">
            <div><b className="text-slate-900">Project URL:</b> <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL || "(not set)"}</span></div>
            <div><b className="text-slate-900">Anon key:</b> <span className="font-mono text-xs">{maskKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || "(not set)"}</span></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_*</code> vars are baked into the client bundle at Docker build time. Changing them requires a Railway redeploy.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
