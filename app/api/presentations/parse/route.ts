import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWorkbook, workbookToContext } from "@/lib/xlsx-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/presentations/parse
 * Body: multipart/form-data with a `file` field.
 * Returns: { sheets, totalRows, detectedType, context }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — 15 MB max" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = await parseWorkbook(buf, file.name);
    const context = workbookToContext(wb);
    return NextResponse.json({
      filename: file.name,
      size: file.size,
      ...wb,
      context,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to parse file" }, { status: 400 });
  }
}
