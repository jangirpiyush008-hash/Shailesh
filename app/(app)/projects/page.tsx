import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, Badge, Button } from "@/components/ui";
import { money, shortDate } from "@/lib/utils";
import { currentProfile } from "@/lib/permissions-server";
import { permissions } from "@/lib/permissions";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = createClient();
  const profile = await currentProfile();
  const perms = permissions(profile);
  const { data: projects } = await supabase
    .from("projects")
    .select("*, coordinator:coordinator_id(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Every project has one Job Card. Click a row to open.</p>
        </div>
        {perms.canCreateProject && (
          <Link href="/projects/new"><Button><Plus size={16} /> New project</Button></Link>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {!projects?.length ? (
            <div className="p-16 text-center">
              <div className="text-slate-500 mb-4">No projects yet.</div>
              {perms.canCreateProject && (
                <Link href="/projects/new"><Button variant="outline">Create your first project</Button></Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="text-left px-5 py-3">Job Card #</th>
                  <th className="text-left px-5 py-3">Project</th>
                  <th className="text-left px-5 py-3">Client</th>
                  <th className="text-left px-5 py-3">Coordinator</th>
                  {perms.canSeeRevenue && <th className="text-left px-5 py-3">Value</th>}
                  <th className="text-left px-5 py-3">Start</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/projects/${p.id}`} className="text-slate-900 hover:text-violet-600">{p.job_card_number}</Link>
                    </td>
                    <td className="px-5 py-3 max-w-[280px] truncate">{p.project_name}</td>
                    <td className="px-5 py-3">{p.client_name}</td>
                    <td className="px-5 py-3 text-slate-600">{p.coordinator_name ?? p.coordinator?.full_name ?? "—"}</td>
                    {perms.canSeeRevenue && <td className="px-5 py-3 tabular-nums">{money(Number(p.project_value))}</td>}
                    <td className="px-5 py-3 text-slate-600">{shortDate(p.start_date)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={p.status === "active" ? "info" : p.status === "completed" || p.status === "closed" ? "success" : "warning"}>{p.status}</Badge>
                    </td>
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
