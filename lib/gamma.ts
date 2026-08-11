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

/** Preset Gamma themes the picker exposes. Full list is much larger; these are safe defaults. */
export const GAMMA_THEMES = [
  { name: "Chisel",       tag: "Bold, warm" },
  { name: "Prism",        tag: "Vibrant, modern" },
  { name: "Bespoke",      tag: "Clean corporate" },
  { name: "Marine",       tag: "Deep blue, professional" },
  { name: "Peppermint",   tag: "Fresh, minimal" },
  { name: "Sketch",       tag: "Hand-drawn casual" },
  { name: "Steel",        tag: "Industrial, muted" },
  { name: "Chartreuse",   tag: "Bright, energetic" },
  { name: "Blueberry",    tag: "Playful gradient" },
  { name: "Terra Cotta",  tag: "Warm earth tones" },
  { name: "Piano",        tag: "Elegant, formal" },
  { name: "Frozen",       tag: "Cool, minimal" },
];
