"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardTitle, Button, Input, Label, Select, Badge, Textarea } from "@/components/ui";
import { money, shortDate, cn } from "@/lib/utils";
import { Plus, Trash2, FileText, Activity } from "lucide-react";

type Cat = { id: string; name: string; side: "left" | "right"; color: string };
type Exp = any;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "left", label: "Materials / Transport / Food" },
  { id: "right", label: "Labour / Vehicle / Food" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
  { id: "reports", label: "Reports" },
] as const;

export function ProjectTabs({
  projectId, expenses, categories, instructions, activity,
}: {
  projectId: string;
  expenses: Exp[];
  categories: Cat[];
  instructions: string;
  activity: any[];
  header: any;
}) {
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("overview");

  return (
    <div>
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition",
                tab === t.id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab expenses={expenses} instructions={instructions} />}
      {tab === "left" && <ExpensesTab side="left" projectId={projectId} expenses={expenses} categories={categories} />}
      {tab === "right" && <ExpensesTab side="right" projectId={projectId} expenses={expenses} categories={categories} />}
      {tab === "documents" && <DocumentsTab projectId={projectId} />}
      {tab === "timeline" && <TimelineTab activity={activity} />}
      {tab === "reports" && <ReportsTab expenses={expenses} categories={categories} />}
    </div>
  );
}

/* -------- Overview -------- */
function OverviewTab({ expenses, instructions }: { expenses: Exp[]; instructions: string }) {
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    const k = e.category_name ?? "Other";
    byCat[k] = (byCat[k] ?? 0) + Number(e.amount ?? 0);
  });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Cost summary by category</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {Object.entries(byCat).length === 0 ? (
            <div className="text-sm text-slate-500 py-4">No expenses yet.</div>
          ) : (
            Object.entries(byCat).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm">{k}</span>
                <span className="tabular-nums font-medium">{money(v)}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{instructions || "—"}</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* -------- Expenses tab (one per side) -------- */
function ExpensesTab({ side, projectId, expenses, categories }: { side: "left" | "right"; projectId: string; expenses: Exp[]; categories: Cat[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sideExp = useMemo(() => expenses.filter((e) => e.side === side), [expenses, side]);
  const total = sideExp.reduce((s, e: any) => s + Number(e.amount ?? 0), 0);
  const sideCats = categories.filter((c) => c.side === side);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form ref BEFORE any await — React nullifies e.currentTarget once we yield.
    const form = e.currentTarget;
    const fd = new FormData(form);

    const catId = String(fd.get("category_id") || "");
    const cat = categories.find((c) => c.id === catId);
    const payload: any = {
      project_id: projectId,
      category_id: catId || null,
      category_name: cat?.name ?? null,
      side,
      entry_date: String(fd.get("entry_date") || new Date().toISOString().slice(0, 10)),
      description: String(fd.get("description") || "").trim(),
      vendor: String(fd.get("vendor") || "") || null,
      unit: String(fd.get("unit") || "") || null,
      quantity: Number(fd.get("quantity") || 0),
      unit_price: Number(fd.get("unit_price") || 0),
    };
    if (side === "right") {
      const hrs = Number(fd.get("total_hours") || 0);
      if (hrs > 0) payload.total_hours = hrs;
    }
    if (!payload.description) { setErr("Description required"); return; }

    setErr(null); setSaving(true);
    try {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      payload.added_by = u.user?.id;

      const { error: insErr } = await supabase.from("expenses").insert(payload);
      if (insErr) throw insErr;

      await supabase.from("activity_log").insert({
        project_id: projectId, user_id: u.user?.id, action: "expense.added",
        entity_type: "expense", meta: { side, category: cat?.name, description: payload.description },
      });

      form.reset();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("activity_log").insert({
        project_id: projectId, user_id: u.user?.id, action: "expense.deleted", entity_type: "expense", entity_id: id,
      });
      router.refresh();
    } catch (e: any) {
      alert("Delete failed: " + (e?.message ?? "unknown"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Add expense</CardTitle></CardHeader>
        <CardBody>
          <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className="md:col-span-1">
              <Label>Date</Label>
              <Input type="date" name="entry_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="md:col-span-1">
              <Label>Category</Label>
              <Select name="category_id" required defaultValue="">
                <option value="">—</option>
                {sideCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2 col-span-2">
              <Label>Description</Label>
              <Input name="description" required placeholder={side === "left" ? "18mm MDF" : "Carpenter"} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input name="unit" placeholder={side === "left" ? "Sheet" : "NOS"} />
            </div>
            <div>
              <Label>Qty</Label>
              <Input type="number" step="0.001" name="quantity" defaultValue="1" />
            </div>
            {side === "right" && (
              <div>
                <Label>Total hrs</Label>
                <Input type="number" step="0.5" name="total_hours" placeholder="216" />
              </div>
            )}
            <div>
              <Label>Rate</Label>
              <Input type="number" step="0.01" name="unit_price" defaultValue="0" />
            </div>
            <div className="md:col-span-2 col-span-2">
              <Label>Vendor / notes</Label>
              <Input name="vendor" />
            </div>
            <div className="col-span-2 md:col-span-7 flex justify-end mt-2">
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-rose-500">
                {saving ? "Saving…" : (<><Plus size={16} /> Add expense</>)}
              </Button>
            </div>
          </form>
          {err && <div className="mt-3 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{side === "left" ? "Materials / Transport / Food Costs" : "Labour / Vehicle / Food Costs"}</CardTitle>
          <div className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-900 tabular-nums">{money(total)}</span></div>
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Unit</th>
                <th className="text-right px-5 py-3">Qty</th>
                {side === "right" && <th className="text-right px-5 py-3">Hours</th>}
                <th className="text-right px-5 py-3">Rate</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="w-10 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {sideExp.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-500">No {side === "left" ? "materials" : "labour"} added yet.</td></tr>
              ) : sideExp.map((e: any) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-slate-700">{shortDate(e.entry_date)}</td>
                  <td className="px-5 py-3"><Badge variant="info">{e.category_name ?? "—"}</Badge></td>
                  <td className="px-5 py-3">{e.description}</td>
                  <td className="px-5 py-3 text-slate-600">{e.unit ?? "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{Number(e.quantity ?? 0).toLocaleString()}</td>
                  {side === "right" && <td className="px-5 py-3 text-right tabular-nums">{e.total_hours ?? "—"}</td>}
                  <td className="px-5 py-3 text-right tabular-nums">{Number(e.unit_price ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">{money(Number(e.amount ?? 0))}</td>
                  <td className="px-3">
                    <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

/* -------- Documents -------- */
function DocumentsTab({ projectId }: { projectId: string }) {
  return (
    <Card>
      <CardBody className="text-center py-16 text-slate-500">
        <FileText size={40} className="mx-auto text-slate-300 mb-3" />
        <div className="mb-4">Document upload UI ships in Phase 2 — but the DB table, RLS policies and Supabase storage bucket are already wired up.</div>
        <div className="text-xs text-slate-400">Project ID: {projectId}</div>
      </CardBody>
    </Card>
  );
}

/* -------- Timeline -------- */
function TimelineTab({ activity }: { activity: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        {activity.length === 0 ? (
          <div className="text-sm text-slate-500 py-4">No activity yet.</div>
        ) : activity.map((a: any) => (
          <div key={a.id} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 grid place-items-center shrink-0"><Activity size={14} className="text-violet-600" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-900"><b>{a.action}</b>{a.meta?.description ? ` — ${a.meta.description}` : ""}</div>
              <div className="text-xs text-slate-500">{a.user?.full_name ?? a.user?.email ?? "Unknown"} · {shortDate(a.created_at)} {new Date(a.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/* -------- Reports -------- */
function ReportsTab({ expenses, categories }: { expenses: Exp[]; categories: Cat[] }) {
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    const k = e.category_name ?? "Other";
    byCat[k] = (byCat[k] ?? 0) + Number(e.amount ?? 0);
  });
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);

  return (
    <Card>
      <CardHeader><CardTitle>Expense breakdown by category</CardTitle></CardHeader>
      <CardBody className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
            <tr>
              <th className="text-left px-5 py-3">Category</th>
              <th className="text-right px-5 py-3">Amount</th>
              <th className="text-right px-5 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="px-5 py-3">{k}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{money(v)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-500">{total > 0 ? ((v / total) * 100).toFixed(1) : "0"}%</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-5 py-3 font-semibold">Total</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">{money(total)}</td>
                <td className="px-5 py-3 text-right tabular-nums">100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
