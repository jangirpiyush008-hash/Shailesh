"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardTitle, Button, Input, Label, Textarea, Badge, Select } from "@/components/ui";
import { money, shortDate, cn } from "@/lib/utils";
import { FileSpreadsheet, Upload, Sparkles, Palette, Loader2, Check, Presentation, Plus, Trash2, X } from "lucide-react";

/* ---------------- Types ---------------- */
type Project = {
  id: string;
  job_card_number: string;
  project_name: string;
  client_name: string;
  project_value: number | null;
  start_date: string | null;
  end_date: string | null;
  exhibition_name: string | null;
  stand_name: string | null;
  status: string;
};

type Outline = {
  title: string;
  sections: { heading: string; bullets: string[] }[];
};

type ParsedWorkbook = {
  filename?: string;
  sheets: { name: string; headers: string[]; rows: any[][]; rowCount: number; colCount: number }[];
  totalRows: number;
  detectedType: string;
  context: string;
};

const THEMES = [
  { name: "Chisel",       tag: "Bold, warm" },
  { name: "Prism",        tag: "Vibrant, modern" },
  { name: "Bespoke",      tag: "Clean corporate" },
  { name: "Marine",       tag: "Deep blue" },
  { name: "Peppermint",   tag: "Fresh, minimal" },
  { name: "Sketch",       tag: "Hand-drawn" },
  { name: "Steel",        tag: "Industrial" },
  { name: "Chartreuse",   tag: "Bright energetic" },
  { name: "Blueberry",    tag: "Playful" },
  { name: "Terra Cotta",  tag: "Warm earth" },
  { name: "Piano",        tag: "Elegant" },
  { name: "Frozen",       tag: "Cool minimal" },
];

/* ---------------- Main flow ---------------- */
export function NewPresentationFlow({
  projects, preselectedProjectId,
}: { projects: Project[]; preselectedProjectId: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [source, setSource] = useState<"project" | "upload">(preselectedProjectId ? "project" : "project");
  const [projectId, setProjectId] = useState<string | null>(preselectedProjectId);
  const [parsedWb, setParsedWb] = useState<ParsedWorkbook | null>(null);

  // Step 2 state
  const [outline, setOutline] = useState<Outline | null>(null);
  const [outlineSource, setOutlineSource] = useState<"openai" | "anthropic" | "template" | null>(null);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 3 state
  const [theme, setTheme] = useState("Chisel");
  const [numCards, setNumCards] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [genStatus, setGenStatus] = useState<{ id?: string; status?: string; gammaUrl?: string; pptxUrl?: string; error?: string }>({});

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  /* ---- Build title + context + data based on source ---- */
  const derivedTitle = source === "project" && selectedProject
    ? `${selectedProject.project_name} — Project Recap`
    : parsedWb ? `Presentation — ${parsedWb.filename ?? "Uploaded data"}` : "Untitled Presentation";

  const derivedContext = source === "project" && selectedProject
    ? projectContext(selectedProject)
    : parsedWb?.context ?? "";

  const derivedData = source === "project" && selectedProject
    ? projectData(selectedProject)
    : undefined;

  /* ---- Step 2: kick off outline generation on entry ---- */
  useEffect(() => {
    if (step === 2 && !outline && !generatingOutline) {
      void requestOutline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function requestOutline() {
    setErr(null); setGeneratingOutline(true);
    try {
      const res = await fetch("/api/presentations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "outline_only",
          title: derivedTitle,
          context: derivedContext,
          data: derivedData,
          numCards,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to generate outline");
      setOutline(j.outline);
      setOutlineSource(j.source);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setGeneratingOutline(false);
    }
  }

  /* ---- Step 3: submit to Gamma ---- */
  async function submitToGamma() {
    if (!outline) return;
    setErr(null); setSubmitting(true);
    try {
      const res = await fetch("/api/presentations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "submit_to_gamma",
          title: outline.title,
          context: derivedContext,
          projectId: source === "project" ? projectId : null,
          sourceType: source,
          outline,
          theme,
          numCards,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGenStatus({ error: j.error ?? "Failed to submit" });
        if (j.id) void pollStatus(j.id);
        return;
      }
      setGenStatus({ id: j.id, status: j.status });
      void pollStatus(j.id);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function pollStatus(id: string) {
    let attempts = 0;
    while (attempts < 60) {          // ~5 min max
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      try {
        const res = await fetch(`/api/presentations/${id}/status`, { cache: "no-store" });
        const j = await res.json();
        setGenStatus({ id, status: j.status, gammaUrl: j.gammaUrl, pptxUrl: j.pptxUrl, error: j.error });
        if (j.status === "completed" || j.status === "failed" || j.error) return;
      } catch { /* keep polling */ }
    }
  }

  const canNext1 = (source === "project" && projectId) || (source === "upload" && parsedWb);
  const canNext2 = outline && outline.title.trim().length > 0 && outline.sections.length > 0;

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {step === 1 && (
        <Step1Source
          source={source} setSource={setSource}
          projects={projects} projectId={projectId} setProjectId={setProjectId}
          parsedWb={parsedWb} setParsedWb={setParsedWb}
          onNext={() => setStep(2)} canNext={!!canNext1}
        />
      )}

      {step === 2 && (
        <Step2Outline
          outline={outline} setOutline={setOutline}
          source={outlineSource}
          loading={generatingOutline} error={err}
          onBack={() => setStep(1)} onNext={() => setStep(3)}
          onRegenerate={requestOutline}
          canNext={!!canNext2}
        />
      )}

      {step === 3 && outline && (
        <Step3Generate
          outline={outline}
          theme={theme} setTheme={setTheme}
          numCards={numCards} setNumCards={setNumCards}
          submitting={submitting}
          genStatus={genStatus}
          onBack={() => setStep(2)}
          onSubmit={submitToGamma}
          onView={() => router.push(`/presentations/${genStatus.id}`)}
        />
      )}
    </div>
  );
}

/* ---------------- Stepper ---------------- */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "Choose source" },
    { n: 2, label: "Edit outline" },
    { n: 3, label: "Pick theme & generate" },
  ];
  return (
    <div className="flex items-center gap-3">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-3 flex-1">
          <div className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
            step === it.n ? "bg-violet-600 text-white" :
            step > it.n ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}>
            <span className="w-5 h-5 rounded-full grid place-items-center text-xs bg-white/20">
              {step > it.n ? <Check size={12} /> : it.n}
            </span>
            {it.label}
          </div>
          {i < items.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Step 1: Source ---------------- */
function Step1Source({
  source, setSource, projects, projectId, setProjectId, parsedWb, setParsedWb, onNext, canNext,
}: any) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true); setUploadErr(null); setParsedWb(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/presentations/parse", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Parse failed");
      setParsedWb(j);
    } catch (e: any) {
      setUploadErr(e?.message ?? "Failed to parse file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setSource("project")}
          className={cn(
            "text-left rounded-xl border-2 p-5 transition",
            source === "project" ? "border-violet-600 bg-violet-50/50" : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 grid place-items-center"><Presentation size={16} /></div>
            <div className="font-medium">From an existing project</div>
          </div>
          <div className="text-sm text-slate-500">Uses live project data (client, dates, expenses, totals) as source.</div>
        </button>
        <button
          type="button"
          onClick={() => setSource("upload")}
          className={cn(
            "text-left rounded-xl border-2 p-5 transition",
            source === "upload" ? "border-violet-600 bg-violet-50/50" : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 grid place-items-center"><FileSpreadsheet size={16} /></div>
            <div className="font-medium">Upload an Excel / CSV</div>
          </div>
          <div className="text-sm text-slate-500">Any workbook — Job Card, financial report, budget sheet, tracker.</div>
        </button>
      </div>

      {source === "project" && (
        <Card>
          <CardHeader><CardTitle>Pick a project</CardTitle></CardHeader>
          <CardBody className="p-0 max-h-[400px] overflow-auto">
            {!projects.length ? (
              <div className="p-10 text-center text-sm text-slate-500">No projects yet. Create one first.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs sticky top-0">
                  <tr>
                    <th className="text-left px-5 py-3 w-8"></th>
                    <th className="text-left px-5 py-3">Job Card</th>
                    <th className="text-left px-5 py-3">Project</th>
                    <th className="text-left px-5 py-3">Client</th>
                    <th className="text-left px-5 py-3">Value</th>
                    <th className="text-left px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p: Project) => (
                    <tr
                      key={p.id}
                      onClick={() => setProjectId(p.id)}
                      className={cn("border-t border-slate-100 cursor-pointer",
                        projectId === p.id ? "bg-violet-50" : "hover:bg-slate-50")}
                    >
                      <td className="px-5 py-3">
                        <div className={cn("w-4 h-4 rounded-full border-2",
                          projectId === p.id ? "border-violet-600 bg-violet-600" : "border-slate-300")} />
                      </td>
                      <td className="px-5 py-3 font-medium">{p.job_card_number}</td>
                      <td className="px-5 py-3 truncate max-w-[240px]">{p.project_name}</td>
                      <td className="px-5 py-3 text-slate-600">{p.client_name}</td>
                      <td className="px-5 py-3 tabular-nums">{money(Number(p.project_value ?? 0))}</td>
                      <td className="px-5 py-3"><Badge variant={p.status === "active" ? "info" : "success"}>{p.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {source === "upload" && (
        <Card>
          <CardHeader><CardTitle>Upload workbook</CardTitle></CardHeader>
          <CardBody>
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-10 cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition">
              <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-600 grid place-items-center"><Upload size={20} /></div>
              <div className="text-sm text-slate-700 font-medium">
                {uploading ? "Parsing…" : "Click to upload .xlsx or .csv (up to 15 MB)"}
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
            {uploadErr && <div className="mt-3 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{uploadErr}</div>}

            {parsedWb && (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <Badge variant="success">Parsed</Badge>
                  <span>{parsedWb.filename} · {parsedWb.sheets.length} sheet(s) · {parsedWb.totalRows} rows · detected as {parsedWb.detectedType}</span>
                </div>
                {parsedWb.sheets.slice(0, 2).map((s) => (
                  <div key={s.name} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">{s.name} ({s.rowCount} rows)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>{s.headers.slice(0, 8).map((h, i) => <th key={i} className="text-left px-3 py-2 border-b border-slate-100 font-medium text-slate-600">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {s.rows.slice(0, 5).map((r, i) => (
                            <tr key={i}>{r.slice(0, 8).map((c, j) => <td key={j} className="px-3 py-2 border-b border-slate-50 text-slate-700">{c == null ? "" : String(c)}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canNext} className="bg-gradient-to-r from-violet-600 to-rose-500">
          Continue →
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 2: Outline ---------------- */
function Step2Outline({
  outline, setOutline, source, loading, error, onBack, onNext, onRegenerate, canNext,
}: any) {
  if (loading) {
    return (
      <Card>
        <CardBody className="p-16 text-center">
          <Loader2 className="animate-spin mx-auto mb-3 text-violet-600" size={32} />
          <div className="text-slate-700 font-medium mb-1">Drafting your outline…</div>
          <div className="text-sm text-slate-500">Using AI to analyze the data and structure slides.</div>
        </CardBody>
      </Card>
    );
  }

  if (!outline) {
    return (
      <Card><CardBody className="p-10 text-center">
        {error ? <div className="text-rose-600 text-sm mb-3">{error}</div> : null}
        <Button onClick={onRegenerate}>Retry outline</Button>
      </CardBody></Card>
    );
  }

  function addSection() {
    setOutline({ ...outline, sections: [...outline.sections, { heading: "New Section", bullets: ["Point 1"] }] });
  }
  function removeSection(idx: number) {
    setOutline({ ...outline, sections: outline.sections.filter((_: any, i: number) => i !== idx) });
  }
  function updateSection(idx: number, patch: any) {
    setOutline({ ...outline, sections: outline.sections.map((s: any, i: number) => i === idx ? { ...s, ...patch } : s) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /> Outline</CardTitle>
          <div className="flex items-center gap-2">
            {source && (
              <Badge variant={source === "template" ? "outline" : "success"}>
                {source === "openai" ? "Generated with OpenAI" :
                 source === "anthropic" ? "Generated with Claude" :
                 "Template (add an AI key for smarter outlines)"}
              </Badge>
            )}
            <Button size="sm" variant="ghost" onClick={onRegenerate}>Regenerate</Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label>Presentation title</Label>
            <Input value={outline.title} onChange={(e) => setOutline({ ...outline, title: e.target.value })} />
          </div>

          <div className="space-y-3">
            {outline.sections.map((s: any, idx: number) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-violet-100 text-violet-700 text-xs grid place-items-center font-semibold">{idx + 1}</span>
                  <Input value={s.heading} onChange={(e) => updateSection(idx, { heading: e.target.value })} placeholder="Section heading" />
                  <button onClick={() => removeSection(idx)} className="text-slate-400 hover:text-rose-600 p-1"><X size={16} /></button>
                </div>
                <Textarea
                  value={s.bullets.join("\n")}
                  onChange={(e) => updateSection(idx, { bullets: e.target.value.split("\n").filter(Boolean) })}
                  placeholder="One bullet per line"
                  className="text-sm"
                  rows={Math.max(3, s.bullets.length + 1)}
                />
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addSection}><Plus size={14} /> Add section</Button>
        </CardBody>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={!canNext} className="bg-gradient-to-r from-violet-600 to-rose-500">Continue →</Button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Theme + Generate ---------------- */
function Step3Generate({
  outline, theme, setTheme, numCards, setNumCards, submitting, genStatus, onBack, onSubmit, onView,
}: any) {
  const isDone = genStatus.status === "completed";
  const isFailed = genStatus.status === "failed" || genStatus.error;
  const isRunning = genStatus.id && !isDone && !isFailed;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette size={16} className="text-violet-600" /> Pick a theme</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setTheme(t.name)}
                className={cn(
                  "text-left rounded-lg border-2 p-4 transition",
                  theme === t.name ? "border-violet-600 bg-violet-50" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="h-16 rounded mb-3 shadow-inner" style={{ background: themeGradient(t.name) }} />
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">{t.tag}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Number of slides</Label>
              <Select value={String(numCards)} onChange={(e) => setNumCards(Number(e.target.value))}>
                {[6, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n} slides</option>)}
              </Select>
            </div>
            <div>
              <Label>Theme</Label>
              <Input value={theme} disabled />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ready to generate</CardTitle></CardHeader>
        <CardBody>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-4 text-sm">
            <div className="font-medium text-slate-900 mb-1">{outline.title}</div>
            <div className="text-slate-500">{outline.sections.length} sections · {numCards} slides · theme <b>{theme}</b></div>
          </div>

          {!genStatus.id && (
            <Button onClick={onSubmit} disabled={submitting} className="w-full bg-gradient-to-r from-violet-600 to-rose-500">
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting to Gamma…</> : <><Sparkles size={16} /> Generate presentation</>}
            </Button>
          )}

          {isRunning && (
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 flex items-center gap-3">
              <Loader2 className="animate-spin text-violet-600" size={20} />
              <div className="flex-1 text-sm">
                <div className="font-medium text-slate-900">Gamma is building your presentation…</div>
                <div className="text-slate-500">This typically takes 60–120 seconds. You can leave this page — status is saved.</div>
              </div>
            </div>
          )}

          {isDone && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-medium"><Check size={18} /> Your presentation is ready!</div>
              <div className="flex gap-2 flex-wrap">
                {genStatus.gammaUrl && <a href={genStatus.gammaUrl} target="_blank" rel="noopener"><Button variant="outline">Open in Gamma</Button></a>}
                {genStatus.pptxUrl && <a href={genStatus.pptxUrl} target="_blank" rel="noopener"><Button variant="outline">Download PPTX</Button></a>}
                <Button onClick={onView} className="bg-gradient-to-r from-violet-600 to-rose-500">View in dashboard</Button>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 space-y-3">
              <div className="font-medium text-rose-800">Generation failed</div>
              <div className="text-sm text-rose-700">{genStatus.error ?? "Unknown error"}</div>
              <Button variant="outline" onClick={onSubmit} disabled={submitting}>Retry</Button>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack} disabled={isRunning}>← Back</Button>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
function projectContext(p: Project): string {
  return [
    `Project: ${p.project_name}`,
    `Job Card: ${p.job_card_number}`,
    `Client: ${p.client_name}`,
    p.exhibition_name ? `Exhibition: ${p.exhibition_name}` : "",
    p.stand_name ? `Stand: ${p.stand_name}` : "",
    p.start_date ? `Start date: ${shortDate(p.start_date)}` : "",
    p.end_date ? `End date: ${shortDate(p.end_date)}` : "",
    p.project_value ? `Project value: AED ${Number(p.project_value).toLocaleString()}` : "",
    `Status: ${p.status}`,
  ].filter(Boolean).join("\n");
}

function projectData(p: Project): Record<string, any> {
  return {
    client_name: p.client_name,
    exhibition_name: p.exhibition_name,
    stand_name: p.stand_name,
    start_date: p.start_date,
    end_date: p.end_date,
    project_value: Number(p.project_value ?? 0),
    status: p.status,
  };
}

function themeGradient(name: string): string {
  const map: Record<string, string> = {
    Chisel:       "linear-gradient(135deg, #F59E0B, #D97706)",
    Prism:        "linear-gradient(135deg, #7C3AED, #EC4899, #F59E0B)",
    Bespoke:      "linear-gradient(135deg, #1F2937, #6B7280)",
    Marine:       "linear-gradient(135deg, #0369A1, #0EA5E9)",
    Peppermint:   "linear-gradient(135deg, #10B981, #6EE7B7)",
    Sketch:       "linear-gradient(135deg, #E5E7EB, #FDE68A)",
    Steel:        "linear-gradient(135deg, #475569, #94A3B8)",
    Chartreuse:   "linear-gradient(135deg, #84CC16, #FACC15)",
    Blueberry:    "linear-gradient(135deg, #6366F1, #A78BFA)",
    "Terra Cotta":"linear-gradient(135deg, #DC2626, #F97316)",
    Piano:        "linear-gradient(135deg, #111827, #374151)",
    Frozen:       "linear-gradient(135deg, #DBEAFE, #93C5FD)",
  };
  return map[name] ?? "linear-gradient(135deg, #7C3AED, #F43F5E)";
}
