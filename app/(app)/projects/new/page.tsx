import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "./project-form";
import { Card, CardBody } from "@/components/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentProfile, permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const me = await currentProfile();
  if (!permissions(me).canCreateProject) redirect("/projects");
  const supabase = createClient();
  const { data: coords } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["admin", "coordinator"]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={14} /> Back to projects
      </Link>
      <h1 className="text-2xl font-semibold mb-1">Create new project</h1>
      <p className="text-sm text-slate-500 mb-6">This creates the Job Card. You can add expenses in the next screen.</p>
      <Card>
        <CardBody>
          <ProjectForm coordinators={coords ?? []} />
        </CardBody>
      </Card>
    </div>
  );
}
