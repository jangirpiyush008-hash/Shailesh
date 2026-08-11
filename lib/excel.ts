import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

/**
 * Reproduces the SBJ Job Card template exactly:
 *
 *  A2 : Company name (bold, merged A2:M2)
 *  A3 : Company address (merged A3:M3)
 *  A4 : "JOB CARD" title (bold, centered, merged A4:M4)
 *
 *  Row 5-10 : Project meta (2 columns: A-F left, G-M right)
 *
 *  Row 16 : Section headers
 *           A-F : "Material / Transport / Food Costs"
 *           G-M : "Labour / Transportation Costs"
 *
 *  Row 17 : Table headers
 *           Left  : Date | Description | UNIT | Quantity | Unit Price | Total
 *           Right : Date | Description | UNIT | Quantity | Total Hours | Unit Price | Total
 *
 *  Row 18+ : Line items with live formulas (F = D*E,  M = K*L when hours present else J*L)
 *
 *  Row 55  : Totals — SUM(F18:F53) and SUM(M18:M54)
 *  Row 57  : Grand total J57 = F55 + M55
 */

export type ProjectHeader = {
  company_name: string;
  company_address: string;
  job_card_number: string;
  project_name: string;
  client_name: string;
  client_address?: string | null;
  client_lpo_no?: string | null;
  client_lpo_date?: string | null;
  stand_name?: string | null;
  exhibition_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  coordinator_name?: string | null;
  instructions?: string | null;
};

export type ExpenseRow = {
  entry_date?: string | null;
  description: string;
  unit?: string | null;
  quantity?: number | null;
  total_hours?: number | null;
  unit_price?: number | null;
  category_name?: string | null;
};

const BORDER = { style: "thin" as const, color: { argb: "FF888888" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2937" } };
const SUBHEAD_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE5E7EB" } };
const SECTION_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF7C3AED" } };
const TOTAL_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF59E0B" } };

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt;
}

export async function buildJobCardWorkbook(
  header: ProjectHeader,
  leftItems: ExpenseRow[],
  rightItems: ExpenseRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = header.company_name;
  wb.created = new Date();

  const ws = wb.addWorksheet("Job Card", {
    pageSetup: {
      paperSize: 9,             // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Column widths (A..M = 13 cols)
  const widths = [12, 34, 8, 10, 12, 14, 12, 26, 8, 10, 12, 12, 14];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Try to embed a raster company logo if one exists at public/sbj-logo.png
  try {
    const logoPath = path.join(process.cwd(), "public", "sbj-logo.png");
    if (fs.existsSync(logoPath)) {
      const imgId = wb.addImage({ filename: logoPath, extension: "png" });
      ws.addImage(imgId, {
        tl: { col: 0.2, row: 0.2 },
        ext: { width: 180, height: 60 },
      });
    }
  } catch { /* logo optional */ }

  // ---------- HEADER (rows 1-4) ----------
  ws.mergeCells("A2:M2");
  const c2 = ws.getCell("A2");
  c2.value = header.company_name;
  c2.font = { name: "Calibri", size: 18, bold: true };
  c2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 28;
  ws.getRow(1).height = 44;   // room for logo

  ws.mergeCells("A3:M3");
  const c3 = ws.getCell("A3");
  c3.value = header.company_address;
  c3.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF555555" } };
  c3.alignment = { horizontal: "center" };

  ws.mergeCells("A4:M4");
  const c4 = ws.getCell("A4");
  c4.value = "JOB CARD";
  c4.font = { name: "Calibri", size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  c4.alignment = { horizontal: "center", vertical: "middle" };
  c4.fill = SECTION_FILL;
  ws.getRow(4).height = 34;

  // ---------- META (rows 5-10) ----------
  const meta: [string, string, any, string, string, any][] = [
    ["A5", "Clients Name",       header.client_name,                      "G5", "Job Card Number",      header.job_card_number],
    ["A6", "Address",             header.client_address ?? "",            "G6", "Stand Name",            header.stand_name ?? ""],
    ["A7", "",                     "",                                     "G7", "Exhibition Name",       header.exhibition_name ?? ""],
    ["A8", "",                     "",                                     "G8", "Work Start Date",       fmtDate(header.start_date)],
    ["A9", "Clients LPO No.",     header.client_lpo_no ?? "",             "G9", "Work End Date",         fmtDate(header.end_date)],
    ["A10","LPO date",            fmtDate(header.client_lpo_date),        "G10","Project Co-ordinator",  header.coordinator_name ?? ""],
  ];

  for (const [lblCell, label, val, lblCell2, label2, val2] of meta) {
    // Left label + value (label in col A, value spans D-F)
    const l = ws.getCell(lblCell);
    l.value = label;
    l.font = { bold: true };
    l.alignment = { vertical: "middle" };
    const rowNum = parseInt(lblCell.slice(1));
    ws.mergeCells(`D${rowNum}:F${rowNum}`);
    const vLeft = ws.getCell(`D${rowNum}`);
    vLeft.value = val;
    vLeft.alignment = { vertical: "middle" };
    if (val instanceof Date) vLeft.numFmt = "yyyy-mm-dd";

    // Right label + value (label in col G, value spans J-M)
    const l2 = ws.getCell(lblCell2);
    l2.value = label2;
    l2.font = { bold: true };
    l2.alignment = { vertical: "middle" };
    ws.mergeCells(`J${rowNum}:M${rowNum}`);
    const vRight = ws.getCell(`J${rowNum}`);
    vRight.value = val2;
    vRight.alignment = { vertical: "middle" };
    if (val2 instanceof Date) vRight.numFmt = "yyyy-mm-dd";

    // Light bottom border for readability
    for (let c = 1; c <= 13; c++) {
      ws.getCell(rowNum, c).border = { bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
    }
  }

  // ---------- INSTRUCTIONS (rows 12-14) ----------
  const ins = ws.getCell("A12");
  ins.value = "Instructions";
  ins.font = { bold: true };
  ws.mergeCells("A13:M14");
  const insV = ws.getCell("A13");
  insV.value = header.instructions ?? "";
  insV.alignment = { wrapText: true, vertical: "top" };
  insV.border = ALL_BORDERS;

  // ---------- SECTION HEADERS (row 16) ----------
  ws.mergeCells("A16:F16");
  const s1 = ws.getCell("A16");
  s1.value = "Material / Transport / Food Costs";
  s1.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  s1.alignment = { horizontal: "center", vertical: "middle" };
  s1.fill = SECTION_FILL;

  ws.mergeCells("G16:M16");
  const s2 = ws.getCell("G16");
  s2.value = "Labour / Transportation Costs";
  s2.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  s2.alignment = { horizontal: "center", vertical: "middle" };
  s2.fill = SECTION_FILL;
  ws.getRow(16).height = 22;

  // ---------- TABLE HEADERS (row 17) ----------
  const leftHeaders = ["Date", "Description", "UNIT", "Quantity", "Unit Price", "Total"];
  const rightHeaders = ["Date", "Description", "UNIT", "Quantity", "Total Hours", "Unit Price", "Total"];
  leftHeaders.forEach((h, i) => {
    const cell = ws.getCell(17, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = HEADER_FILL;
    cell.border = ALL_BORDERS;
  });
  rightHeaders.forEach((h, i) => {
    const cell = ws.getCell(17, i + 7);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = HEADER_FILL;
    cell.border = ALL_BORDERS;
  });
  ws.getRow(17).height = 24;

  // ---------- LINE ITEMS (rows 18..54) ----------
  const FIRST = 18;
  const MAX = 54;
  const leftEnd = 55;   // total row (matches your template F55)
  const rightEnd = 55;  // total row for right side (M55)

  // Left side (Materials / Transport / Food)
  leftItems.slice(0, MAX - FIRST + 1).forEach((it, i) => {
    const r = FIRST + i;
    ws.getCell(r, 1).value = fmtDate(it.entry_date);
    if (ws.getCell(r, 1).value instanceof Date) ws.getCell(r, 1).numFmt = "yyyy-mm-dd";
    ws.getCell(r, 2).value = it.description;
    ws.getCell(r, 3).value = it.unit ?? "";
    ws.getCell(r, 4).value = it.quantity ?? null;
    ws.getCell(r, 5).value = it.unit_price ?? null;
    ws.getCell(r, 6).value = { formula: `D${r}*E${r}` };
    ws.getCell(r, 6).numFmt = "#,##0.00";
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = ALL_BORDERS;
    // Highlight rows where a category name appears in description (subhead visual)
    if (it.category_name && /graphics|electric|food|vehicle/i.test(it.description) === false && !it.description) {
      ws.getCell(r, 2).font = { bold: true };
      ws.getCell(r, 2).fill = SUBHEAD_FILL;
    }
  });

  // Right side (Labour / Transportation / Food)
  rightItems.slice(0, MAX - FIRST + 1).forEach((it, i) => {
    const r = FIRST + i;
    ws.getCell(r, 7).value = fmtDate(it.entry_date);
    if (ws.getCell(r, 7).value instanceof Date) ws.getCell(r, 7).numFmt = "yyyy-mm-dd";
    ws.getCell(r, 8).value = it.description;
    ws.getCell(r, 9).value = it.unit ?? "";
    ws.getCell(r, 10).value = it.quantity ?? null;
    ws.getCell(r, 11).value = it.total_hours ?? null;
    ws.getCell(r, 12).value = it.unit_price ?? null;
    // If total_hours present use K*L else J*L (matches template formulas)
    const usesHours = it.total_hours != null && it.total_hours > 0;
    ws.getCell(r, 13).value = { formula: usesHours ? `K${r}*L${r}` : `J${r}*L${r}` };
    ws.getCell(r, 13).numFmt = "#,##0.00";
    for (let c = 7; c <= 13; c++) ws.getCell(r, c).border = ALL_BORDERS;
  });

  // ---------- TOTALS (row 55 & 57) ----------
  ws.getCell(`D${leftEnd}`).value = "Total In AED";
  ws.getCell(`D${leftEnd}`).font = { bold: true };
  ws.getCell(`D${leftEnd}`).alignment = { horizontal: "right" };
  ws.getCell(`D${leftEnd}`).fill = TOTAL_FILL;
  ws.getCell(`F${leftEnd}`).value = { formula: `SUM(F${FIRST}:F${MAX - 1})` };
  ws.getCell(`F${leftEnd}`).font = { bold: true };
  ws.getCell(`F${leftEnd}`).numFmt = "#,##0.00";
  ws.getCell(`F${leftEnd}`).fill = TOTAL_FILL;

  ws.getCell(`J${rightEnd}`).value = "Total In AED";
  ws.getCell(`J${rightEnd}`).font = { bold: true };
  ws.getCell(`J${rightEnd}`).alignment = { horizontal: "right" };
  ws.getCell(`J${rightEnd}`).fill = TOTAL_FILL;
  ws.getCell(`M${rightEnd}`).value = { formula: `SUM(M${FIRST}:M${MAX})` };
  ws.getCell(`M${rightEnd}`).font = { bold: true };
  ws.getCell(`M${rightEnd}`).numFmt = "#,##0.00";
  ws.getCell(`M${rightEnd}`).fill = TOTAL_FILL;

  // Grand total row 57
  ws.mergeCells("A57:I57");
  const gtLabel = ws.getCell("A57");
  gtLabel.value = "Final Total of the Job";
  gtLabel.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  gtLabel.alignment = { horizontal: "right", vertical: "middle" };
  gtLabel.fill = HEADER_FILL;

  ws.mergeCells("J57:M57");
  const gtVal = ws.getCell("J57");
  gtVal.value = { formula: `F${leftEnd}+M${rightEnd}` };
  gtVal.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  gtVal.alignment = { horizontal: "center", vertical: "middle" };
  gtVal.numFmt = "#,##0.00";
  gtVal.fill = HEADER_FILL;
  ws.getRow(57).height = 30;

  // Print area
  ws.pageSetup.printArea = "A1:M57";
  ws.pageSetup.horizontalCentered = true;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
