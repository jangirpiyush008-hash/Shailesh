"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardTitle, Button, Input, Label, Select, Badge, Textarea } from "@/components/ui";
import { money, shortDate, cn } from "@/lib/utils";
import { UNITS, LABOUR_PRESETS } from "@/lib/constants";
import { Plus, Trash2, FileText, Activity } from "lucide-react";

type Cat = { id: string; name: string; side: "left" | "right"; color: string };
type Exp = any;

const ALL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "left",     label: "Materials" },
  { id: "right",    label: "Labour" },
  { id: "documents",label: "Documents" },
  { id: "timeline", label: "Timeline" },
  { id: "reports",  label: "Reports" },
] as const;

export type ExpensePerms = {
  canSeeLinePrices: boolean;
  canSeeTotals: boolean;
  canEnterPrice: boolean;
  canDeleteExpense: boolean;
  canSeeOverviewTab: boolean;
  canSeeReportsTab: boolean;
};

export function ProjectTabs({
  projectId, expenses, categories, instructions, activity, perms,
}: {
  projectId: string;
  expenses: Exp[];
  categories: Cat[];
  instructions: string;
  activity: any[];
  header: any;
  perms: ExpensePerms;
}) {
  const TABS = ALL_TABS.filter((t) => {
    if (t.id === "overview" && !perms.canSeeOverviewTab) return false;
    if (t.id === "reports"  && !perms.canSeeReportsTab)  return false;
    return true;
  });
  const [tab, setTab] = useState<typeof ALL_TABS[number]["id"]>(TABS[0].id);

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

      {tab === "overview" && perms.canSeeOverviewTab && <OverviewTab expenses={expenses} instructions={instructions} />}
      {tab === "left" && <ExpensesTab side="left" projectId={projectId} expenses={expenses} categories={categories} perms={perms} />}
      {tab === "right" && <ExpensesTab side="right" projectId={projectId} expenses={expenses} categories={categories} perms={perms} />}
      {tab === "documents" && <DocumentsTab projectId={projectId} />}
      {tab === "timeline" && <TimelineTab activity={activity} />}
      {tab === "reports" && perms.canSeeReportsTab && <ReportsTab expenses={expenses} categories={categories} />}
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
function ExpensesTab({ side, projectId, expenses, categories, perms }: { side: "left" | "right"; projectId: string; expenses: Exp[]; categories: Cat[]; perms: ExpensePerms }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sideExp = useMemo(() => expenses.filter((e) => e.side === side), [expenses, side]);
  const total = sideExp.reduce((s, e: any) => s + Number(e.amount ?? 0), 0);
  const sideCats = categories.filter((c) => c.side === side);

  // Live Amount preview state — updates as user types Qty / Hours / Rate
  const [qty, setQty] = useState<number>(1);
  const [hours, setHours] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [labourLoc, setLabourLoc] = useState<string>("");   // At Workshop / On Site (labour side only)
  const liveAmount = side === "right" && hours > 0
    ? hours * rate
    : qty * rate;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form ref BEFORE any await — React nullifies e.currentTarget once we yield.
    const form = e.currentTarget;
    const fd = new FormData(form);

    const catId = String(fd.get("category_id") || "");
    const cat = categories.find((c) => c.id === catId);
    let description = String(fd.get("description") || "").trim();
    // Labour rows: prefix with location so it reads "On Site — Carpenter"
    if (side === "right" && labourLoc && !description.startsWith(labourLoc)) {
      description = description ? `${labourLoc} — ${description}` : labourLoc;
    }
    const payload: any = {
      project_id: projectId,
      category_id: catId || null,
      category_name: cat?.name ?? null,
      side,
      entry_date: String(fd.get("entry_date") || new Date().toISOString().slice(0, 10)),
      description,
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
      setQty(1); setHours(0); setRate(0); setLabourLoc("");   // reset live preview state
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
      {side === "right" && (
        <Card className="bg-gradient-to-r from-violet-50 to-rose-50 border-violet-200">
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white grid place-items-center text-violet-600 shrink-0">
                <Activity size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 mb-1">Track your labour team</div>
                <div className="text-sm text-slate-600 mb-3">First pick <b>where</b> the labour is, then the <b>role</b>. Description auto-fills like <i>"On-site — Carpenter"</i>. Total = Hours × Rate.</div>

                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Location</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["At Workshop", "On Site"].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        data-loc={loc}
                        onClick={(ev) => {
                          const btn = ev.currentTarget;
                          // Highlight the active location
                          btn.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-loc]").forEach((b) => {
                            b.classList.remove("bg-violet-600", "text-white", "border-violet-600");
                            b.classList.add("bg-white", "border-slate-200", "text-slate-700");
                          });
                          btn.classList.remove("bg-white", "border-slate-200", "text-slate-700");
                          btn.classList.add("bg-violet-600", "text-white", "border-violet-600");
                          // Remember it on the form for later chip clicks
                          const form = btn.closest("form");
                          if (form) form.dataset.location = loc;
                          const input = document.querySelector<HTMLInputElement>('input[name="description"]');
                          if (input) {
                            const roleMatch = input.value.replace(/^(At Workshop|On Site)\s*—\s*/, "");
                            input.value = `${loc} — ${roleMatch || ""}`.trim().replace(/—\s*$/, "").trim();
                            input.focus();
                          }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium hover:border-violet-400 transition"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Role</div>
                  <div className="flex flex-wrap gap-1.5">
                    {LABOUR_PRESETS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          const input = document.querySelector<HTMLInputElement>('input[name="description"]');
                          if (input) {
                            // Look for active location button
                            const form = input.closest("form") as HTMLFormElement | null;
                            const loc = form?.dataset.location || "";
                            input.value = loc ? `${loc} — ${role}` : role;
                            input.focus();
                          }
                        }}
                        className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-violet-400 hover:text-violet-700 text-slate-700 font-medium transition"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>{side === "right" ? "Add labour entry" : "Add expense"}</CardTitle></CardHeader>
        <CardBody>
          <form onSubmit={add} className={cn(
            "grid grid-cols-2 gap-3",
            side === "right" ? "md:grid-cols-10" : "md:grid-cols-8"
          )}>
            <div>
              <Label>Date</Label>
              <Input type="date" name="entry_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div>
              <Label>Category</Label>
              <Select name="category_id" required defaultValue="">
                <option value="">—</option>
                {sideCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            {side === "right" && (
              <div>
                <Label>Location</Label>
                <Select value={labourLoc} onChange={(e) => setLabourLoc(e.target.value)} required>
                  <option value="">— Select —</option>
                  <option value="At Workshop">At Workshop</option>
                  <option value="On Site">On Site</option>
                </Select>
              </div>
            )}
            <div className="md:col-span-2 col-span-2">
              <Label>Description</Label>
              <Input
                name="description"
                required
                placeholder={side === "left" ? "18mm MDF" : "Carpenter"}
                list={side === "right" ? "labour-presets" : undefined}
              />
              {side === "right" && (
                <datalist id="labour-presets">
                  {LABOUR_PRESETS.map((l) => <option key={l} value={l} />)}
                </datalist>
              )}
            </div>
            <div>
              <Label>Unit</Label>
              <Select name="unit" defaultValue={side === "left" ? "Sheet" : "NOS"}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number" step="0.001" name="quantity"
                value={qty} onChange={(e) => setQty(Number(e.target.value || 0))}
              />
            </div>
            {side === "right" && (
              <div>
                <Label>Total hours</Label>
                <Input
                  type="number" step="0.5" name="total_hours" placeholder="216"
                  value={hours || ""} onChange={(e) => setHours(Number(e.target.value || 0))}
                />
              </div>
            )}
            {perms.canEnterPrice && (
              <>
                <div>
                  <Label>Unit rate</Label>
                  <Input
                    type="number" step="0.01" name="unit_price"
                    value={rate} onChange={(e) => setRate(Number(e.target.value || 0))}
                  />
                </div>
                {/* Total — read-only, styled like the other inputs but green so it stands out */}
                <div>
                  <Label className="text-emerald-700">Total</Label>
                  <div className="h-10 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 flex items-center text-emerald-900 font-semibold tabular-nums text-sm">
                    {money(liveAmount)}
                  </div>
                </div>
              </>
            )}

            <div className="md:col-span-4 col-span-2">
              <Label>Vendor / notes</Label>
              <Input name="vendor" />
            </div>
            <div className={cn(
              "col-span-2 flex justify-end items-end",
              perms.canEnterPrice
                ? (side === "right" ? "md:col-span-6" : "md:col-span-4")
                : (side === "right" ? "md:col-span-4" : "md:col-span-2")
            )}>
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-rose-500 h-10">
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
          {perms.canSeeTotals && (
            <div className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-900 tabular-nums">{money(total)}</span></div>
          )}
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Unit</th>
                <th className="text-right px-5 py-3">Quantity</th>
                {side === "right" && <th className="text-right px-5 py-3">Hours</th>}
                {perms.canSeeLinePrices && <th className="text-right px-5 py-3">Unit Rate</th>}
                {perms.canSeeLinePrices && <th className="text-right px-5 py-3">Total</th>}
                {perms.canDeleteExpense && <th className="w-10 px-3"></th>}
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
                  {perms.canSeeLinePrices && <td className="px-5 py-3 text-right tabular-nums">{Number(e.unit_price ?? 0).toLocaleString()}</td>}
                  {perms.canSeeLinePrices && <td className="px-5 py-3 text-right font-medium tabular-nums">{money(Number(e.amount ?? 0))}</td>}
                  {perms.canDeleteExpense && (
                    <td className="px-3">
                      <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={14} /></button>
                    </td>
                  )}
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
