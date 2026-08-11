import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { KpiCard } from "@/components/kpi-card";
import { RevenueTrend, ExpenseCategoryChart, StatusBar } from "@/components/dashboard-charts";
import { money, shortDate } from "@/lib/utils";
import { Briefcase, TrendingUp, DollarSign, CheckCircle2, Clock, AlertTriangle, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: projects }, { data: expenses }] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("id, amount, category_name, entry_date, project_id").order("entry_date", { ascending: false }).limit(500),
  ]);

  const P = projects ?? [];
  const E = expenses ?? [];

  const totals = {
    active: P.filter((p) => p.status === "active").length,
    completed: P.filter((p) => p.status === "completed" || p.status === "closed").length,
    pending: P.filter((p) => p.status === "pending" || p.status === "on_hold").length,
    revenue: P.reduce((s, p) => s + Number(p.project_value ?? 0), 0),
    cost: E.reduce((s, e) => s + Number(e.amount ?? 0), 0),
  };
  const profit = totals.revenue - totals.cost;

  // Revenue trend (last 6 months, expenses aggregated by month)
  const monthly: Record<string, { month: string; revenue: number; expenses: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = { month: d.toLocaleDateString(undefined, { month: "short" }), revenue: 0, expenses: 0 };
  }
  E.forEach((e) => {
    const k = (e.entry_date ?? "").slice(0, 7);
    if (monthly[k]) monthly[k].expenses += Number(e.amount ?? 0);
  });
  P.forEach((p) => {
    const k = (p.start_date ?? p.created_at ?? "").slice(0, 7);
    if (monthly[k]) monthly[k].revenue += Number(p.project_value ?? 0);
  });

  // Expense breakdown
  const catMap: Record<string, number> = {};
  E.forEach((e) => {
    const k = e.category_name ?? "Other";
    catMap[k] = (catMap[k] ?? 0) + Number(e.amount ?? 0);
  });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // Status chart
  const statusData = ["active", "pending", "completed", "closed", "on_hold"].map((s) => ({
    status: s,
    count: P.filter((p) => p.status === s).length,
  }));

  const recentProjects = P.slice(0, 5);
  const recentExpenses = E.slice(0, 6);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time view of projects, revenue and expenses.</p>
        </div>
        <Link href="/projects/new">
          <Button><Plus size={16} /> New project</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Active" value={totals.active} icon={Briefcase} tone="violet" />
        <KpiCard label="Completed" value={totals.completed} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Pending" value={totals.pending} icon={Clock} tone="amber" />
        <KpiCard label="Revenue" value={money(totals.revenue)} icon={TrendingUp} tone="sky" />
        <KpiCard label="Total cost" value={money(totals.cost)} icon={DollarSign} tone="rose" />
        <KpiCard label="Net profit" value={money(profit)} sub={profit >= 0 ? "In profit" : "In loss"} icon={AlertTriangle} tone={profit >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueTrend data={Object.values(monthly)} />
        </div>
        <ExpenseCategoryChart data={catData.length ? catData : [{ name: "No data yet", value: 1 }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent projects</CardTitle>
              <Link href="/projects" className="text-sm text-violet-600 hover:underline">View all →</Link>
            </CardHeader>
            <CardBody className="p-0">
              {recentProjects.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">No projects yet. <Link href="/projects/new" className="text-violet-600">Create one</Link>.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="text-left px-5 py-3">Job Card</th>
                      <th className="text-left px-5 py-3">Client</th>
                      <th className="text-left px-5 py-3">Value</th>
                      <th className="text-left px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProjects.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-violet-600">{p.job_card_number}</Link>
                          <div className="text-xs text-slate-500 truncate max-w-[240px]">{p.project_name}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-700">{p.client_name}</td>
                        <td className="px-5 py-3 tabular-nums">{money(Number(p.project_value))}</td>
                        <td className="px-5 py-3"><Badge variant={p.status === "active" ? "info" : p.status === "completed" || p.status === "closed" ? "success" : "warning"}>{p.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
        <StatusBar data={statusData} />
      </div>

      <Card>
        <CardHeader><CardTitle>Latest expenses</CardTitle></CardHeader>
        <CardBody className="p-0">
          {recentExpenses.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No expenses recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Category</th>
                  <th className="text-left px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{shortDate(e.entry_date)}</td>
                    <td className="px-5 py-3">{e.category_name ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{money(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
