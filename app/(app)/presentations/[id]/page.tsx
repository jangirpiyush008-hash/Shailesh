import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { shortDate } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Download, Sparkles } from "lucide-react";
import { PresentationStatus } from "./poller";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { variant: any; label: string }> = {
  draft:      { variant: "outline",  label: "Draft" },
  generating: { variant: "warning",  label: "Generating" },
  completed:  { variant: "success",  label: "Ready" },
  failed:     { variant: "danger",   label: "Failed" },
};

export default async function PresentationDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("presentations")
    .select("*, project:project_id(id, project_name, job_card_number)")
    .eq("id", params.id)
    .single();

  if (!p) return notFound();

  const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft;
  const outline = (p.outline_json as any) ?? { title: p.title, sections: [] };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <Link href="/presentations" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Presentations
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold">{p.title}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>Theme: <b className="text-slate-700">{p.theme}</b></span>
            <span>Slides: <b className="text-slate-700">{p.num_cards}</b></span>
            <span>Created: {shortDate(p.created_at)}</span>
            {p.project && (
              <span>Project: <Link href={`/projects/${p.project.id}`} className="text-violet-600 hover:underline">{p.project.job_card_number}</Link></span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {p.gamma_url && (
            <a href={p.gamma_url} target="_blank" rel="noopener">
              <Button variant="outline"><ExternalLink size={16} /> Open in Gamma</Button>
            </a>
          )}
          {p.pptx_url && (
            <a href={p.pptx_url} target="_blank" rel="noopener">
              <Button variant="outline"><Download size={16} /> Download PPTX</Button>
            </a>
          )}
        </div>
      </div>

      {p.status === "generating" && p.gamma_generation_id && (
        <PresentationStatus id={p.id} />
      )}

      {p.status === "failed" && p.error_message && (
        <Card>
          <CardBody className="bg-rose-50 border-rose-200">
            <div className="font-medium text-rose-800 mb-1">Generation failed</div>
            <div className="text-sm text-rose-700">{p.error_message}</div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /> Outline</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          {outline.sections?.map((s: any, i: number) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded bg-violet-100 text-violet-700 text-xs grid place-items-center font-semibold">{i + 1}</span>
                <div className="font-medium">{s.heading}</div>
              </div>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 pl-4">
                {(s.bullets ?? []).map((b: string, j: number) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
