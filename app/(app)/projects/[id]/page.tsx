import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { KpiCard } from "@/components/kpi-card";
import { money, shortDate } from "@/lib/utils";
import { ArrowLeft, FileSpreadsheet, FileText, Presentation, DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { ProjectTabs } from "./project-tabs";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: project }, { data: expenses }, { data: cats }, { data: activity }] = await Promise.all([
    supabase.from("projects").select("*, coordinator:coordinator_id(full_name, email)").eq("id", params.id).single(),
    supabase.from("expenses").select("*, added_by_p:added_by(full_name, email)").eq("project_id", params.id).order("entry_date", { ascending: true }),
    supabase.from("expense_categories").select("*").eq("is_active", true).order("side").order("sort_order"),
    supabase.from("activity_log").select("*, user:user_id(full_name, email)").eq("project_id", params.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (!project) return notFound();

  const E = expenses ?? [];
  const totalCost = E.reduce((s, e: any) => s + Number(e.amount ?? 0), 0);
  const revenue = Number(project.project_value ?? 0);
  const profit = revenue - totalCost;
  const profitPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const budgetUsedPct = revenue > 0 ? Math.min((totalCost / revenue) * 100, 999) : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft size={14} /> Projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.project_name}</h1>
            <Badge variant={project.status === "active" ? "info" : project.status === "closed" || project.status === "completed" ? "success" : "warning"}>{project.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
            <span><b className="text-slate-700">{project.job_card_number}</b></span>
            <span>Client: {project.client_name}</span>
            {project.exhibition_name && <span>Exhibition: {project.exhibition_name}</span>}
            {project.stand_name && <span>Stand: {project.stand_name}</span>}
            {project.coordinator?.full_name && <span>Coordinator: {project.coordinator.full_name}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/projects/${params.id}/export`} target="_blank">
            <Button variant="outline"><FileSpreadsheet size={16} /> Export Excel</Button>
          </Link>
          <Button variant="outline" disabled title="Coming in Phase 2"><FileText size={16} /> PDF</Button>
          <Button className="bg-gradient-to-r from-violet-600 to-rose-500" disabled title="Coming — add your Gamma API key first"><Presentation size={16} /> Generate PPT</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Project value" value={money(revenue)} icon={DollarSign} tone="sky" />
        <KpiCard label="Total cost" value={money(totalCost)} icon={Wallet} tone="rose" />
        <KpiCard label="Net profit" value={money(profit)} sub={`${profitPct.toFixed(1)}%`} icon={profit >= 0 ? TrendingUp : TrendingDown} tone={profit >= 0 ? "emerald" : "rose"} />
        <KpiCard label="Budget used" value={`${budgetUsedPct.toFixed(0)}%`} sub={budgetUsedPct >= 100 ? "Over budget" : budgetUsedPct >= 90 ? "Approaching limit" : budgetUsedPct >= 80 ? "Watch this" : "OK"} icon={DollarSign} tone={budgetUsedPct >= 100 ? "rose" : budgetUsedPct >= 80 ? "amber" : "emerald"} />
      </div>

      <ProjectTabs
        projectId={project.id}
        expenses={E}
        categories={cats ?? []}
        instructions={project.instructions ?? ""}
        activity={activity ?? []}
        header={{
          job_card_number: project.job_card_number,
          client_name: project.client_name,
          client_address: project.client_address,
          stand_name: project.stand_name,
          exhibition_name: project.exhibition_name,
          start_date: project.start_date,
          end_date: project.end_date,
          coordinator_name: project.coordinator?.full_name ?? null,
        }}
      />
    </div>
  );
}
