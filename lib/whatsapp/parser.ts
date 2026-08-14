/**
 * Natural language expense parser.
 *
 * Given freeform text like "JC415 material 25 sheets 18mm mdf @ 53 danube"
 * returns structured fields the state machine can use to save an expense.
 *
 * Priority:
 *   1. OpenAI (gpt-4o-mini) if OPENAI_API_KEY is set — best at Hinglish
 *   2. Anthropic Claude (haiku)  if ANTHROPIC_API_KEY is set
 *   3. Deterministic regex fallback — handles the common shorthand
 */

export type ParsedExpense = {
  project_code?: string;         // e.g. "JC415", "SBJ-JC-26-415"
  side?: "left" | "right";
  category?: string;             // must match one of expense_categories.name
  description?: string;
  unit?: string;
  quantity?: number;
  total_hours?: number;
  unit_price?: number;
  vendor?: string;
  location?: string;             // "At Workshop" / "On Site" (labour only)
  confidence: number;            // 0-1
  reasoning?: string;
};

const KNOWN_UNITS = ["Sheet","NOS","SQM","SQY","RM","Hours","Pkt","Trip","Drum","Litre","Gallon","ITEM"] as const;
const KNOWN_CATEGORIES = [
  "Material","Transport","Food","Paint Work","Glass Work","Electric","Flooring Work","Carpet","Graphics",
  "Labour","Vehicle","Accommodation","Rental","Equipment","Miscellaneous",
] as const;

const LABOUR_ROLES = ["carpenter","painter","electrician","helper","driver","loader","fabricator","welder","foreman","supervisor"];

const SYSTEM = `You parse freeform WhatsApp messages from Indian/UAE fabrication workers into JSON expense entries.

Return valid JSON matching:
{
  "project_code": "JC415" (short code the user mentioned, uppercase),
  "side": "left" (materials/transport/food) or "right" (labour/vehicle/food/accommodation),
  "category": one of ["Material","Transport","Food","Paint Work","Glass Work","Electric","Flooring Work","Carpet","Graphics","Labour","Vehicle","Accommodation","Rental","Equipment","Miscellaneous"],
  "description": short description (e.g. "18mm MDF" or "Carpenter"),
  "unit": one of ["Sheet","NOS","SQM","SQY","RM","Hours","Pkt","Trip","Drum","Litre","Gallon","ITEM"],
  "quantity": number,
  "total_hours": number (labour only, when user says "216 hrs"),
  "unit_price": number (per-unit or per-hour rate in AED),
  "vendor": vendor name if mentioned (e.g. "Danube", "Ace"),
  "location": "At Workshop" or "On Site" (labour side only, when user says "on site" or "workshop"),
  "confidence": 0.0-1.0 (your confidence in the parse),
  "reasoning": one short sentence explaining what you extracted
}

Rules:
- The message is often in Hinglish (mix of Hindi and English) — handle both.
- Common shortcuts: "sheet" = Sheet unit, "nos" = NOS, "pkt" = Pkt, "drum" = Drum, "litre/ltr" = Litre, "rm" = running meter.
- Labour is right-side; materials/transport/food are left-side.
- If user says "carpenter", "painter", "electrician", "helper", "driver", "loader" → side=right, category=Labour.
- If user says "3ton truck", "hiace", "trip" → side=right, category=Vehicle, unit=Trip.
- If user says "breakfast/lunch/dinner" → side=left, category=Food, unit=NOS.
- Rate parsing: "@ 53" or "at 53" or "53 rupya" or "53 aed" → unit_price=53.
- Return ONLY the JSON object — no markdown, no extra prose.`;

export async function parseExpenseMessage(text: string): Promise<ParsedExpense> {
  const clean = text.trim();
  if (!clean) return { confidence: 0 };

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      const p = await parseWithOpenAI(clean);
      if (p && (p.confidence ?? 0) > 0) return p;
    } catch (e) { console.warn("[wa parser] OpenAI failed:", e); }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const p = await parseWithClaude(clean);
      if (p && (p.confidence ?? 0) > 0) return p;
    } catch (e) { console.warn("[wa parser] Claude failed:", e); }
  }
  // Regex fallback
  return parseWithRegex(clean);
}

async function parseWithOpenAI(text: string): Promise<ParsedExpense | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }],
      temperature: 0.1,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return parseJson(raw);
}

async function parseWithClaude(text: string): Promise<ParsedExpense | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "{}";
  return parseJson(raw);
}

function parseJson(raw: string): ParsedExpense | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const j = JSON.parse(cleaned);
    // Normalise
    const out: ParsedExpense = {
      project_code: j.project_code ? String(j.project_code).toUpperCase().replace(/\s+/g, "") : undefined,
      side: j.side === "right" ? "right" : j.side === "left" ? "left" : undefined,
      category: KNOWN_CATEGORIES.includes(j.category) ? j.category : undefined,
      description: j.description ? String(j.description).trim() : undefined,
      unit: KNOWN_UNITS.includes(j.unit) ? j.unit : undefined,
      quantity: typeof j.quantity === "number" ? j.quantity : undefined,
      total_hours: typeof j.total_hours === "number" && j.total_hours > 0 ? j.total_hours : undefined,
      unit_price: typeof j.unit_price === "number" ? j.unit_price : undefined,
      vendor: j.vendor ? String(j.vendor).trim() : undefined,
      location: j.location === "On Site" || j.location === "At Workshop" ? j.location : undefined,
      confidence: Math.max(0, Math.min(1, Number(j.confidence ?? 0.5))),
      reasoning: j.reasoning,
    };
    return out;
  } catch { return null; }
}

/* -------------------- Regex fallback -------------------- */
function parseWithRegex(text: string): ParsedExpense {
  const t = text.toLowerCase();
  const out: ParsedExpense = { confidence: 0.3 };

  // Project code — "jc415", "jc-26-415", "sbj-jc-26-415"
  const codeMatch = text.match(/\b(sbj[-\s]?)?jc[-\s]?(\d{2}[-\s])?[-]?(\d{3,})\b/i);
  if (codeMatch) {
    out.project_code = codeMatch[0].toUpperCase().replace(/\s+/g, "").replace(/-{2,}/g, "-");
    out.confidence += 0.2;
  }

  // Rate: "@ 53", "at 53", "53 aed"
  const rateMatch = t.match(/(?:@|at|rate)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*aed/i);
  if (rateMatch) { out.unit_price = Number(rateMatch[1] ?? rateMatch[2]); out.confidence += 0.15; }

  // Hours: "216 hrs", "216 hours"
  const hrsMatch = t.match(/(\d+(?:\.\d+)?)\s*hr?s?\b/);
  if (hrsMatch) { out.total_hours = Number(hrsMatch[1]); out.confidence += 0.1; }

  // Quantity: "25 sheet", "12 nos", "3 trip"
  const qtyMatch = t.match(/\b(\d+(?:\.\d+)?)\s*(sheet|nos|pkt|drum|litre|ltr|trip|rm|sqm|sqy|item)/i);
  if (qtyMatch) {
    out.quantity = Number(qtyMatch[1]);
    const u = qtyMatch[2].toLowerCase();
    const unitMap: any = { sheet: "Sheet", nos: "NOS", pkt: "Pkt", drum: "Drum", litre: "Litre", ltr: "Litre", trip: "Trip", rm: "RM", sqm: "SQM", sqy: "SQY", item: "ITEM" };
    out.unit = unitMap[u];
    out.confidence += 0.15;
  }

  // Labour role detection → side=right, category=Labour
  for (const role of LABOUR_ROLES) {
    if (t.includes(role)) {
      out.side = "right";
      out.category = "Labour";
      out.description = role[0].toUpperCase() + role.slice(1);
      if (!out.unit) out.unit = "NOS";
      out.confidence += 0.15;
      break;
    }
  }

  // Vehicle
  if (/\b(truck|hiace|force|3ton|vehicle|van)\b/.test(t)) {
    out.side = "right";
    out.category = "Vehicle";
    if (!out.unit) out.unit = "Trip";
    out.confidence += 0.1;
  }

  // Food
  if (/\b(breakfast|lunch|dinner|food|khaana|khana)\b/.test(t)) {
    out.side = "left";
    out.category = "Food";
    if (!out.unit) out.unit = "NOS";
    out.confidence += 0.1;
  }

  // Location
  if (/\b(on\s*site|on-site|onsite|site\s*pe|site pe)\b/.test(t)) out.location = "On Site";
  else if (/\bworkshop\b/.test(t)) out.location = "At Workshop";

  // If we detected qty+rate but no side, default to material
  if (out.quantity && out.unit_price && !out.side) {
    out.side = "left";
    out.category = "Material";
  }

  // Description fallback — everything except project code + numbers
  if (!out.description) {
    const words = text.split(/\s+/).filter((w) => {
      if (out.project_code && w.toUpperCase().includes(out.project_code)) return false;
      if (/^\d+(\.\d+)?$/.test(w)) return false;
      if (/^(sheet|nos|pkt|drum|litre|ltr|trip|rm|sqm|sqy|item|hr|hrs|aed|at|from)$/i.test(w)) return false;
      return true;
    });
    if (words.length) out.description = words.slice(0, 6).join(" ");
  }

  out.confidence = Math.min(1, out.confidence);
  return out;
}
