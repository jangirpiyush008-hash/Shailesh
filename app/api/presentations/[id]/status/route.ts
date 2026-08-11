import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGenerationStatus, GammaNotConfiguredError } from "@/lib/gamma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/presentations/[id]/status
 * Polls Gamma for the current status and persists progress back to DB.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("presentations")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If already terminal, just return
  if (row.status === "completed" || row.status === "failed") {
    return NextResponse.json({
      id: row.id,
      status: row.status,
      gammaUrl: row.gamma_url,
      pptxUrl: row.pptx_url,
      error: row.error_message,
    });
  }

  if (!row.gamma_generation_id) {
    return NextResponse.json({ id: row.id, status: row.status });
  }

  try {
    const s = await getGenerationStatus(row.gamma_generation_id);
    const update: any = {};
    if (s.status === "completed") {
      update.status = "completed";
      update.gamma_url = s.gammaUrl ?? row.gamma_url;
      update.pptx_url = s.pptxUrl ?? row.pptx_url;
    } else if (s.status === "failed") {
      update.status = "failed";
      update.error_message = s.errorMessage ?? "Gamma reported failure";
    }
    if (Object.keys(update).length) {
      await supabase.from("presentations").update(update).eq("id", row.id);
    }
    return NextResponse.json({
      id: row.id,
      status: update.status ?? "generating",
      gammaUrl: update.gamma_url ?? row.gamma_url,
      pptxUrl: update.pptx_url ?? row.pptx_url,
      error: update.error_message,
    });
  } catch (e: any) {
    if (e instanceof GammaNotConfiguredError) {
      return NextResponse.json({ id: row.id, error: "GAMMA_API_KEY not set" }, { status: 400 });
    }
    return NextResponse.json({ id: row.id, error: String(e?.message ?? e) }, { status: 502 });
  }
}
