import { shortDate } from "./utils";

const REPORT_WHATSAPP = "971505118431";     // SBJ official WhatsApp
const CURRENCY = "AED";

type ProjectLike = {
  job_card_number: string;
  project_name: string;
  client_name: string;
  exhibition_name?: string | null;
  stand_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  project_value?: number | null;
  coordinator_name?: string | null;
  coordinator?: { full_name?: string | null } | null;
};

type ExpenseLike = {
  side: "left" | "right";
  category_name?: string | null;
  description: string;
  amount?: number | string | null;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Builds a WhatsApp-friendly project report string. */
export function buildWhatsAppReport(project: ProjectLike, expenses: ExpenseLike[]): string {
  const left = expenses.filter((e) => e.side === "left");
  const right = expenses.filter((e) => e.side === "right");
  const materialTotal = left.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const labourTotal   = right.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const grand         = materialTotal + labourTotal;
  const revenue       = Number(project.project_value ?? 0);
  const profit        = revenue - grand;
  const profitPct     = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Category breakdown for materials side
  const catMap: Record<string, number> = {};
  for (const e of expenses) {
    const k = e.category_name ?? "Other";
    catMap[k] = (catMap[k] ?? 0) + Number(e.amount ?? 0);
  }
  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const coord = project.coordinator_name || project.coordinator?.full_name || "—";

  const lines = [
    `*SBJ Technical Works LLC*`,
    `*Project Report — ${project.job_card_number}*`,
    ``,
    `📁 *Project:* ${project.project_name}`,
    `👤 *Client:* ${project.client_name}`,
    project.exhibition_name ? `🎪 *Exhibition:* ${project.exhibition_name}` : "",
    project.stand_name ? `🏛 *Stand:* ${project.stand_name}` : "",
    project.start_date || project.end_date
      ? `📅 *Dates:* ${shortDate(project.start_date)} → ${shortDate(project.end_date)}`
      : "",
    `👷 *Coordinator:* ${coord}`,
    ``,
    `💰 *Financial Summary*`,
    `Project value:  ${CURRENCY} ${fmt(revenue)}`,
    `Materials + Transport + Food:  ${CURRENCY} ${fmt(materialTotal)}`,
    `Labour + Vehicle + Food:  ${CURRENCY} ${fmt(labourTotal)}`,
    `*Total cost:  ${CURRENCY} ${fmt(grand)}*`,
    `*Net profit:  ${CURRENCY} ${fmt(profit)}  (${profitPct.toFixed(1)}%)*`,
    ``,
    topCats.length ? `📊 *Top expense categories*` : "",
    ...topCats.map(([k, v]) => `• ${k}: ${CURRENCY} ${fmt(v)}`),
    ``,
    `— Generated from SBJ JobCard Dashboard`,
  ].filter(Boolean);

  return lines.join("\n");
}

/** Builds the wa.me deep link for the given report. */
export function whatsAppShareUrl(report: string, phone: string = REPORT_WHATSAPP): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(report)}`;
}
