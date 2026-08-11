import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Key, Sparkles, Presentation, Bot } from "lucide-react";

export default function SettingsPage() {
  const integrations = [
    { name: "Gamma API", desc: "Auto-generate presentations from project data.", key: "GAMMA_API_KEY", icon: Presentation, status: "pending" as const },
    { name: "OpenAI", desc: "AI slide content, executive summaries, insights.", key: "OPENAI_API_KEY", icon: Sparkles, status: "pending" as const },
    { name: "Anthropic Claude", desc: "Long-doc analysis and content generation.", key: "ANTHROPIC_API_KEY", icon: Bot, status: "pending" as const },
    { name: "Google Gemini", desc: "Multimodal analysis of uploaded files.", key: "GEMINI_API_KEY", icon: Bot, status: "pending" as const },
  ];

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure integrations. Keys live in <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">.env.local</code> for now — a UI-based key manager ships in Phase 2.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Key size={18} /> Integrations</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          {integrations.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.key} className="flex items-start gap-4 p-4 rounded-lg border border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 grid place-items-center shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{i.name}</div>
                    <Badge variant={i.status === "pending" ? "warning" : "success"}>
                      {i.status === "pending" ? "Not configured" : "Connected"}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">{i.desc}</div>
                  <div className="mt-2 text-xs font-mono text-slate-400">Env var: {i.key}</div>
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
          <div className="mt-3 text-xs text-slate-500">Change these via <code className="bg-slate-100 px-1.5 py-0.5 rounded">COMPANY_NAME</code> and <code className="bg-slate-100 px-1.5 py-0.5 rounded">COMPANY_ADDRESS</code> in <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env.local</code>. They appear at the top of every exported Job Card.</div>
        </CardBody>
      </Card>
    </div>
  );
}
