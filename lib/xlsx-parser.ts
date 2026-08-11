import ExcelJS from "exceljs";

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  colCount: number;
};

export type ParsedWorkbook = {
  sheets: ParsedSheet[];
  totalRows: number;
  detectedType: "job_card" | "generic";
};

/**
 * Parses a .xlsx or .csv buffer and returns a structured preview.
 * - Skips empty leading/trailing rows.
 * - Detects the header row (first row where >=50% of cells are strings).
 * - Caps at 200 rows/50 cols per sheet for preview safety.
 */
export async function parseWorkbook(buf: Buffer, filename?: string): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  if (filename && /\.csv$/i.test(filename)) {
    // ExcelJS csv reader needs a stream — we'll load as text and split
    const text = buf.toString("utf8");
    return { sheets: [csvSheet(text)], totalRows: 0, detectedType: "generic" };
  }
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  const sheets: ParsedSheet[] = [];
  let totalRows = 0;

  wb.eachSheet((ws) => {
    const rows: (string | number | null)[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values: (string | number | null)[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v == null) { values.push(null); return; }
        if (typeof v === "object" && "result" in (v as any)) { values.push((v as any).result ?? null); return; }
        if (v instanceof Date) { values.push(v.toISOString().slice(0, 10)); return; }
        if (typeof v === "object" && "text" in (v as any)) { values.push((v as any).text); return; }
        values.push(v as any);
      });
      // trim trailing nulls
      while (values.length && values[values.length - 1] == null) values.pop();
      if (values.length) rows.push(values);
    });

    if (!rows.length) return;

    // header detection: first row that is majority strings
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const stringRatio = rows[i].filter((c) => typeof c === "string" && c.trim()).length / Math.max(1, rows[i].length);
      if (stringRatio >= 0.5) { headerIdx = i; break; }
    }
    const headers = rows[headerIdx].map((c, i) => (c == null || String(c).trim() === "") ? `Column ${i + 1}` : String(c));
    const dataRows = rows.slice(headerIdx + 1, headerIdx + 1 + 200);

    const colCount = Math.max(headers.length, ...dataRows.map((r) => r.length), 1);

    sheets.push({
      name: ws.name,
      headers: headers.slice(0, 50),
      rows: dataRows.map((r) => r.slice(0, 50)),
      rowCount: rows.length - headerIdx - 1,
      colCount,
    });
    totalRows += rows.length;
  });

  const detectedType = detectType(sheets);
  return { sheets, totalRows, detectedType };
}

function csvSheet(text: string): ParsedSheet {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) return { name: "CSV", headers: [], rows: [], rowCount: 0, colCount: 0 };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1, 201).map(splitCsvLine);
  return {
    name: "CSV",
    headers,
    rows,
    rowCount: lines.length - 1,
    colCount: headers.length,
  };
}

function splitCsvLine(line: string): (string | number | null)[] {
  // simple parser — handles quoted fields with commas
  const out: (string | number | null)[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(coerce(cur)); cur = ""; }
      else if (c === '"' && cur === "") inQ = true;
      else cur += c;
    }
  }
  out.push(coerce(cur));
  return out;
}

function coerce(v: string): string | number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && t === String(n) ? n : t;
}

function detectType(sheets: ParsedSheet[]): "job_card" | "generic" {
  const flatHeaders = sheets.flatMap((s) => s.headers.map((h) => h.toLowerCase()));
  const hits = ["job card", "material", "labour", "unit price", "total in aed", "quantity"].filter((k) =>
    flatHeaders.some((h) => h.includes(k))
  ).length;
  return hits >= 3 ? "job_card" : "generic";
}

/** Turn parsed sheets into a compact text summary suitable for AI context. */
export function workbookToContext(wb: ParsedWorkbook): string {
  const parts: string[] = [];
  parts.push(`Workbook contains ${wb.sheets.length} sheet(s) — detected as ${wb.detectedType}.`);
  for (const s of wb.sheets) {
    parts.push(`\n## Sheet: ${s.name}  (${s.rowCount} rows × ${s.colCount} cols)`);
    parts.push(`Columns: ${s.headers.join(" | ")}`);
    const sample = s.rows.slice(0, 8).map((r) => r.map((c) => c == null ? "" : String(c)).join(" | "));
    if (sample.length) parts.push(`Sample rows:\n${sample.join("\n")}`);

    // Try to extract totals if any numeric column exists
    const numCols = s.headers.map((_h, i) => ({
      i,
      total: s.rows.reduce((acc, r) => acc + (typeof r[i] === "number" ? (r[i] as number) : 0), 0),
      hasNums: s.rows.some((r) => typeof r[i] === "number"),
    })).filter((c) => c.hasNums);

    if (numCols.length) {
      parts.push(`Column totals:`);
      numCols.forEach((c) => parts.push(`  ${s.headers[c.i]}: ${c.total.toLocaleString()}`));
    }
  }
  return parts.join("\n");
}
