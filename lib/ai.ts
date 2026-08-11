/**
 * AI outline generator with graceful fallback.
 *
 * Priority:
 *   1. OpenAI (gpt-4o-mini) if OPENAI_API_KEY is set
 *   2. Anthropic Claude (claude-3-5-haiku) if ANTHROPIC_API_KEY is set
 *   3. Deterministic template — no AI, structured from the input data
 *
 * All three return the same shape so callers don't need to branch.
 */

export type Outline = {
  title: string;
  sections: { heading: string; bullets: string[] }[];
};

export type OutlineInput = {
  title: string;
  context: string;           // freeform description of the project or dataset
  data?: Record<string, any>; // optional structured facts (revenue, cost, categories)
  desiredSlides?: number;    // hint for section count
};

const SYSTEM_PROMPT = `You are a presentation writer for SBJ Technical Works, an events + fitout company in Dubai. Turn the given project data into a crisp, professional slide outline.

Return valid JSON matching this exact shape:
{
  "title": "string",
  "sections": [
    { "heading": "string", "bullets": ["string", "string", ...] }
  ]
}

Rules:
- 6 to 12 sections total (unless "desiredSlides" says otherwise).
- Each section: heading is 2-6 words, 2-5 bullets, each bullet <= 20 words.
- Include sections in this order when data supports it: Cover, Client Overview, Project Scope, Timeline, Budget, Revenue, Expense Breakdown, Deliverables, Challenges & Solutions, Outcomes, Thank You.
- Use the exact numeric figures from the data. Do NOT invent metrics.
- No markdown, no explanations — only the JSON object.`;

export function isAiConfigured(): { openai: boolean; anthropic: boolean; any: boolean } {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  return { openai, anthropic, any: openai || anthropic };
}

/** Main entry point: tries OpenAI → Anthropic → template fallback. */
export async function generateOutline(input: OutlineInput): Promise<{ outline: Outline; source: "openai" | "anthropic" | "template" }> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const outline = await generateWithOpenAI(input);
      return { outline, source: "openai" };
    } catch (e) {
      console.warn("[ai] OpenAI failed, trying next:", e);
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const outline = await generateWithAnthropic(input);
      return { outline, source: "anthropic" };
    } catch (e) {
      console.warn("[ai] Anthropic failed, using template:", e);
    }
  }
  return { outline: generateWithTemplate(input), source: "template" };
}

/* ----------------- OpenAI ----------------- */
async function generateWithOpenAI(input: OutlineInput): Promise<Outline> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(input) },
      ],
      temperature: 0.4,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return parseOutline(text, input.title);
}

/* ----------------- Anthropic ----------------- */
async function generateWithAnthropic(input: OutlineInput): Promise<Outline> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(input) }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  return parseOutline(text, input.title);
}

function userPrompt(input: OutlineInput): string {
  return [
    `TITLE: ${input.title}`,
    `DESIRED_SLIDES: ${input.desiredSlides ?? 10}`,
    ``,
    `CONTEXT:`,
    input.context,
    ``,
    input.data ? `STRUCTURED_DATA:\n${JSON.stringify(input.data, null, 2)}` : "",
  ].filter(Boolean).join("\n");
}

function parseOutline(raw: string, fallbackTitle: string): Outline {
  try {
    // Some models wrap in code fences — strip them
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.sections)) {
      return {
        title: parsed.title,
        sections: parsed.sections
          .filter((s: any) => s && typeof s.heading === "string" && Array.isArray(s.bullets))
          .map((s: any) => ({
            heading: String(s.heading).slice(0, 80),
            bullets: s.bullets.filter((b: any) => typeof b === "string").map((b: string) => b.slice(0, 200)),
          })),
      };
    }
  } catch {}
  return { title: fallbackTitle, sections: fallbackSections() };
}

function fallbackSections() {
  return [
    { heading: "Cover", bullets: ["Project overview and highlights"] },
    { heading: "Overview", bullets: ["Scope", "Deliverables", "Timeline"] },
    { heading: "Thank You", bullets: ["Contact us"] },
  ];
}

/* ----------------- Template fallback ----------------- */
export function generateWithTemplate(input: OutlineInput): Outline {
  const d = input.data ?? {};
  const money = (n: any) => (typeof n === "number" ? `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—");

  const sections: Outline["sections"] = [
    { heading: "Overview", bullets: [
      d.client_name ? `Client: ${d.client_name}` : "Client details on the next slides",
      d.exhibition_name ? `Exhibition: ${d.exhibition_name}` : "",
      d.stand_name ? `Stand: ${d.stand_name}` : "",
      d.venue ? `Venue: ${d.venue}` : "",
    ].filter(Boolean) },
    { heading: "Timeline", bullets: [
      d.start_date ? `Start: ${d.start_date}` : "Timeline in project brief",
      d.end_date ? `End: ${d.end_date}` : "",
    ].filter(Boolean) },
    { heading: "Budget & Revenue", bullets: [
      `Project value: ${money(d.project_value)}`,
      `Estimated profit: ${money(d.estimated_profit)}`,
      d.status ? `Status: ${d.status}` : "",
    ].filter(Boolean) },
  ];

  if (d.expense_categories && typeof d.expense_categories === "object") {
    sections.push({
      heading: "Expense Breakdown",
      bullets: Object.entries(d.expense_categories).slice(0, 8).map(([k, v]) => `${k}: ${money(v as number)}`),
    });
  }

  if (d.total_cost != null || d.net_profit != null) {
    sections.push({
      heading: "Financials",
      bullets: [
        d.total_cost != null ? `Total cost: ${money(d.total_cost)}` : "",
        d.net_profit != null ? `Net profit: ${money(d.net_profit)}` : "",
      ].filter(Boolean),
    });
  }

  sections.push({ heading: "Thank You", bullets: [`SBJ Technical Works LLC`, `Dubai Industrial City`] });

  return {
    title: input.title,
    sections: [
      { heading: input.title, bullets: [input.context.split("\n")[0]?.slice(0, 120) || "Project overview"] },
      ...sections,
    ],
  };
}
