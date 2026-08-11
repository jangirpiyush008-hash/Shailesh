/**
 * Gamma public API client.
 * Docs: https://developers.gamma.app  (v0.2)
 *
 * We use two endpoints:
 *  POST /v0.2/generations           — submit an outline + theme
 *  GET  /v0.2/generations/{id}      — poll for completion
 *
 * Auth header: X-API-KEY  (set GAMMA_API_KEY in Railway Variables)
 */

const GAMMA_BASE = "https://public-api.gamma.app/v0.2";

export type GammaGenerateInput = {
  inputText: string;                         // outline as text/markdown
  textMode?: "generate" | "condense" | "preserve";
  format?: "presentation" | "document" | "social";
  themeName?: string;
  numCards?: number;                         // 1..50
  additionalInstructions?: string;
  exportAs?: "pptx" | "pdf";
  cardSplit?: "auto" | "inputTextBreaks";
  imageOptions?: { model?: string; source?: "aiGenerated" | "unsplash" | "web" };
};

export type GammaGenerateResponse = {
  generationId: string;
  credits?: { deducted: number; remaining: number };
};

export type GammaStatusResponse = {
  generationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  gammaUrl?: string;
  pptxUrl?: string;
  pdfUrl?: string;
  errorMessage?: string;
};

export class GammaNotConfiguredError extends Error {
  constructor() {
    super("GAMMA_API_KEY is not set. Add it in Railway → Variables.");
    this.name = "GammaNotConfiguredError";
  }
}

function key(): string {
  const k = process.env.GAMMA_API_KEY;
  if (!k) throw new GammaNotConfiguredError();
  return k;
}

export async function generatePresentation(input: GammaGenerateInput): Promise<GammaGenerateResponse> {
  const res = await fetch(`${GAMMA_BASE}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key(),
    },
    body: JSON.stringify({
      textMode: "generate",
      format: "presentation",
      themeName: "Chisel",
      numCards: 10,
      exportAs: "pptx",
      ...input,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gamma API ${res.status}: ${body || res.statusText}`);
  }
  return (await res.json()) as GammaGenerateResponse;
}

export async function getGenerationStatus(generationId: string): Promise<GammaStatusResponse> {
  const res = await fetch(`${GAMMA_BASE}/generations/${encodeURIComponent(generationId)}`, {
    method: "GET",
    headers: { "X-API-KEY": key() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gamma status ${res.status}: ${body || res.statusText}`);
  }
  const data: any = await res.json();
  return {
    generationId: data.generationId ?? generationId,
    status: data.status,
    gammaUrl: data.gammaUrl ?? data.url,
    pptxUrl: data.pptxUrl ?? data.exportUrl,
    pdfUrl: data.pdfUrl,
    errorMessage: data.errorMessage ?? data.error,
  };
}

/** Convert a structured outline to the text format Gamma expects. */
export function outlineToText(outline: {
  title: string;
  sections: { heading: string; bullets: string[] }[];
}): string {
  const lines: string[] = [`# ${outline.title}`, ""];
  for (const s of outline.sections) {
    lines.push(`## ${s.heading}`);
    for (const b of s.bullets) {
      lines.push(`- ${b}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Curated Gamma themes — real theme names from Gamma's catalog, grouped by category. */
export type GammaTheme = {
  name: string;
  tag: string;
  category: "Corporate" | "Vibrant" | "Minimal" | "Warm" | "Cool" | "Creative" | "Dark";
  gradient: string;              // CSS gradient for the picker preview
  recommendedFor?: string;
};

export const GAMMA_THEMES: GammaTheme[] = [
  // ---------- Corporate ----------
  { name: "Bespoke",     tag: "Clean corporate",     category: "Corporate", gradient: "linear-gradient(135deg, #1F2937 0%, #4B5563 100%)", recommendedFor: "Client pitches" },
  { name: "Consultant",  tag: "Executive polish",    category: "Corporate", gradient: "linear-gradient(135deg, #0F172A 0%, #334155 100%)" },
  { name: "Marine",      tag: "Deep blue authority", category: "Corporate", gradient: "linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)", recommendedFor: "Investor decks" },
  { name: "Meridian",    tag: "Modern minimal",      category: "Corporate", gradient: "linear-gradient(135deg, #1E3A8A 0%, #6366F1 100%)" },
  { name: "Steel",       tag: "Industrial muted",    category: "Corporate", gradient: "linear-gradient(135deg, #475569 0%, #94A3B8 100%)", recommendedFor: "Construction / fitout" },
  { name: "Basalt",      tag: "Solid, weighty",      category: "Corporate", gradient: "linear-gradient(135deg, #292524 0%, #78716C 100%)" },

  // ---------- Vibrant ----------
  { name: "Prism",       tag: "Rainbow gradient",    category: "Vibrant",   gradient: "linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)", recommendedFor: "Product launches" },
  { name: "Chartreuse",  tag: "Bright & energetic",  category: "Vibrant",   gradient: "linear-gradient(135deg, #84CC16 0%, #FACC15 100%)" },
  { name: "Peacock",     tag: "Rich teal & gold",    category: "Vibrant",   gradient: "linear-gradient(135deg, #0891B2 0%, #F59E0B 100%)" },
  { name: "Cotton Candy",tag: "Soft dream pastels",  category: "Vibrant",   gradient: "linear-gradient(135deg, #F9A8D4 0%, #A5B4FC 100%)" },

  // ---------- Warm ----------
  { name: "Chisel",      tag: "Bold gold on stone",  category: "Warm",      gradient: "linear-gradient(135deg, #E6A817 0%, #D97706 100%)", recommendedFor: "SBJ brand match" },
  { name: "Terra Cotta", tag: "Warm earth clay",     category: "Warm",      gradient: "linear-gradient(135deg, #DC2626 0%, #F97316 100%)" },
  { name: "Coral",       tag: "Sun-kissed reef",     category: "Warm",      gradient: "linear-gradient(135deg, #FB7185 0%, #FDBA74 100%)" },
  { name: "Vintage",     tag: "Aged paper tones",    category: "Warm",      gradient: "linear-gradient(135deg, #A16207 0%, #E7C39F 100%)" },
  { name: "Rustic",      tag: "Earthy woodgrain",    category: "Warm",      gradient: "linear-gradient(135deg, #78350F 0%, #C2A377 100%)" },
  { name: "Dune",        tag: "Desert sand & sky",   category: "Warm",      gradient: "linear-gradient(135deg, #F3E8CC 0%, #D6A15F 100%)" },

  // ---------- Cool ----------
  { name: "Peppermint",  tag: "Fresh mint & white",  category: "Cool",      gradient: "linear-gradient(135deg, #10B981 0%, #6EE7B7 100%)" },
  { name: "Frost",       tag: "Icy pale minimal",    category: "Cool",      gradient: "linear-gradient(135deg, #DBEAFE 0%, #93C5FD 100%)" },
  { name: "Icebreaker",  tag: "Arctic blue",         category: "Cool",      gradient: "linear-gradient(135deg, #E0F2FE 0%, #7DD3FC 100%)" },
  { name: "Blueberry",   tag: "Deep playful purple", category: "Cool",      gradient: "linear-gradient(135deg, #6366F1 0%, #A78BFA 100%)" },

  // ---------- Minimal ----------
  { name: "Wireframe",   tag: "Pure structure",      category: "Minimal",   gradient: "linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%)" },
  { name: "Kraft",       tag: "Recycled paper",      category: "Minimal",   gradient: "linear-gradient(135deg, #F5EBD8 0%, #C8A97E 100%)" },
  { name: "Newsprint",   tag: "Editorial b&w",       category: "Minimal",   gradient: "linear-gradient(135deg, #FAFAF9 0%, #A8A29E 100%)" },
  { name: "Alabaster",   tag: "Warm off-white",      category: "Minimal",   gradient: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" },

  // ---------- Creative ----------
  { name: "Sketch",      tag: "Hand-drawn casual",   category: "Creative",  gradient: "linear-gradient(135deg, #FDE68A 0%, #F3F4F6 100%)" },
  { name: "Almanac",     tag: "Journal illustrated", category: "Creative",  gradient: "linear-gradient(135deg, #F5EBD8 0%, #6B7280 100%)" },
  { name: "Nomad",       tag: "Boho traveler",       category: "Creative",  gradient: "linear-gradient(135deg, #92400E 0%, #F59E0B 100%)" },

  // ---------- Dark ----------
  { name: "Piano",       tag: "Elegant midnight",    category: "Dark",      gradient: "linear-gradient(135deg, #111827 0%, #374151 100%)", recommendedFor: "Formal reports" },
  { name: "Onyx",        tag: "Pure black premium",  category: "Dark",      gradient: "linear-gradient(135deg, #000000 0%, #52525B 100%)" },
  { name: "Nightsky",    tag: "Deep space navy",     category: "Dark",      gradient: "linear-gradient(135deg, #0F172A 0%, #6366F1 100%)" },
];

export const GAMMA_CATEGORIES: GammaTheme["category"][] = [
  "Corporate", "Vibrant", "Warm", "Cool", "Minimal", "Creative", "Dark",
];
