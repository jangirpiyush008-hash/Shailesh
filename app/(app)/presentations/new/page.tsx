import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { NewPresentationFlow } from "./flow";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage({ searchParams }: { searchParams: { project?: string } }) {
  const supabase = createClient();

  // Preload projects for the "From project" picker
  const { data: projects } = await supabase
    .from("projects")
    .select("id, job_card_number, project_name, client_name, project_value, start_date, end_date, exhibition_name, stand_name, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/presentations" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={14} /> Back to presentations
      </Link>
      <h1 className="text-2xl font-semibold mb-1">New presentation</h1>
      <p className="text-sm text-slate-500 mb-6">Generate a professional deck from a project or an uploaded Excel — the outline is AI-drafted, you edit, then pick a theme and Gamma builds it.</p>

      <NewPresentationFlow
        projects={projects ?? []}
        preselectedProjectId={searchParams.project ?? null}
      />
    </div>
  );
}
