import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildJobCardWorkbook, type ExpenseRow, type ProjectHeader } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: project, error: pErr }, { data: expenses }] = await Promise.all([
    supabase.from("projects").select("*, coordinator:coordinator_id(full_name)").eq("id", params.id).single(),
    supabase.from("expenses").select("*").eq("project_id", params.id).order("entry_date", { ascending: true }),
  ]);
  if (pErr || !project) return new NextResponse("Not found", { status: 404 });

  const header: ProjectHeader = {
    company_name: process.env.COMPANY_NAME || "SBJ Technical Works LLC",
    company_address: process.env.COMPANY_ADDRESS || "Dubai Industrial City",
    job_card_number: project.job_card_number,
    project_name: project.project_name,
    client_name: project.client_name,
    client_address: project.client_address,
    client_lpo_no: project.client_lpo_no,
    client_lpo_date: project.client_lpo_date,
    stand_name: project.stand_name,
    exhibition_name: project.exhibition_name,
    start_date: project.start_date,
    end_date: project.end_date,
    coordinator_name: project.coordinator_name ?? (project as any).coordinator?.full_name ?? null,
    instructions: project.instructions,
  };

  const left: ExpenseRow[] = (expenses ?? []).filter((e: any) => e.side === "left").map((e: any) => ({
    entry_date: e.entry_date, description: e.description, unit: e.unit,
    quantity: e.quantity, unit_price: e.unit_price, category_name: e.category_name,
  }));
  const right: ExpenseRow[] = (expenses ?? []).filter((e: any) => e.side === "right").map((e: any) => ({
    entry_date: e.entry_date, description: e.description, unit: e.unit,
    quantity: e.quantity, total_hours: e.total_hours, unit_price: e.unit_price, category_name: e.category_name,
  }));

  const buf = await buildJobCardWorkbook(header, left, right);

  // Log export
  await supabase.from("activity_log").insert({
    project_id: params.id, user_id: user.id, action: "export.excel",
    entity_type: "project", entity_id: params.id, meta: { format: "xlsx" },
  });

  const filename = `JobCard_${project.job_card_number}.xlsx`.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
