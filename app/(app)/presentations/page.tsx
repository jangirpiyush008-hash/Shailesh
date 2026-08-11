import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, Badge, Button } from "@/components/ui";
import { shortDate } from "@/lib/utils";
import { Plus, Presentation, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { variant: any; label: string }> = {
  draft:      { variant: "outline",  label: "Draft" },
  generating: { variant: "warning",  label: "Generating" },
  completed:  { variant: "success",  label: "Ready" },
  failed:     { variant: "danger",   label: "Failed" },
};

export default async function PresentationsPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("presentations")
    .select("*, project:project_id(project_name, job_card_number)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Presentations</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered presentations built from project data or uploaded Excel files, generated via Gamma.</p>
        </div>
        <Link href="/presentations/new"><Button><Plus size={16} /> New presentation</Button></Link>
      </div>

      <Card>
        <CardBody className="p-0">
          {!rows?.length ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 grid place-items-center mx-auto mb-4"><Presentation size={22} /></div>
              <div className="text-slate-600 mb-2 font-medium">No presentations yet</div>
              <div className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                Generate a professional presentation from any project's data or upload an Excel file. Powered by Gamma with AI-written slide content.
              </div>
              <Link href="/presentations/new"><Button variant="outline">Create your first presentation</Button></Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">Source</th>
                  <th className="text-left px-5 py-3">Theme</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.draft;
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">
                        <Link href={`/presentations/${r.id}`} className="text-slate-900 hover:text-violet-600">{r.title}</Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {r.source_type === "project" && r.project
                          ? <span>{r.project.job_card_number}</span>
                          : <Badge variant="info">Excel upload</Badge>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{r.theme ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{shortDate(r.created_at)}</td>
                      <td className="px-5 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="px-5 py-3 text-right">
                        {r.gamma_url && (
                          <a href={r.gamma_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-violet-600 hover:underline text-sm">
                            Open in Gamma <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
