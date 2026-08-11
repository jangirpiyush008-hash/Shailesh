import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutline, isAiConfigured, generateWithTemplate, type Outline } from "@/lib/ai";
import { generatePresentation, outlineToText, GammaNotConfiguredError } from "@/lib/gamma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  mode: "outline_only" | "submit_to_gamma";
  title: string;
  context: string;
  projectId?: string | null;
  sourceType?: "project" | "upload";
  outline?: Outline;              // if user has already edited an outline
  theme?: string;
  numCards?: number;
  data?: Record<string, any>;
  additionalInstructions?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // ---- Mode 1: just build/preview the outline (no Gamma call) ----
  if (body.mode === "outline_only") {
    const { outline, source } = await generateOutline({
      title: body.title,
      context: body.context,
      data: body.data,
      desiredSlides: body.numCards,
    });
    return NextResponse.json({ outline, source, ai: isAiConfigured() });
  }

  // ---- Mode 2: submit outline to Gamma + persist ----
  if (!body.outline) {
    return NextResponse.json({ error: "outline required for submit_to_gamma" }, { status: 400 });
  }

  const text = outlineToText(body.outline);

  // Persist a draft row first so we can track it even if Gamma call fails
  const { data: inserted, error: insertErr } = await supabase
    .from("presentations")
    .insert({
      title: body.title,
      source_type: body.sourceType ?? (body.projectId ? "project" : "upload"),
      project_id: body.projectId ?? null,
      outline_json: body.outline,
      theme: body.theme ?? "Chisel",
      num_cards: body.numCards ?? 10,
      status: "generating",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message ?? "DB insert failed" }, { status: 500 });
  }

  try {
    const gamma = await generatePresentation({
      inputText: text,
      textMode: "generate",
      format: "presentation",
      themeName: body.theme ?? "Chisel",
      numCards: body.numCards ?? 10,
      additionalInstructions: body.additionalInstructions,
      exportAs: "pptx",
    });

    await supabase
      .from("presentations")
      .update({ gamma_generation_id: gamma.generationId })
      .eq("id", inserted.id);

    await supabase.from("activity_log").insert({
      project_id: body.projectId ?? null,
      user_id: user.id,
      action: "presentation.submitted",
      entity_type: "presentation",
      entity_id: inserted.id,
      meta: { theme: body.theme, num_cards: body.numCards, title: body.title },
    });

    return NextResponse.json({ id: inserted.id, generationId: gamma.generationId, status: "generating" });
  } catch (e: any) {
    const isMissingKey = e instanceof GammaNotConfiguredError;
    await supabase
      .from("presentations")
      .update({
        status: "failed",
        error_message: isMissingKey ? "GAMMA_API_KEY is not set in Railway Variables." : String(e?.message ?? e),
      })
      .eq("id", inserted.id);
    return NextResponse.json({
      id: inserted.id,
      error: isMissingKey ? "Gamma API key not configured" : String(e?.message ?? e),
    }, { status: isMissingKey ? 400 : 502 });
  }
}
