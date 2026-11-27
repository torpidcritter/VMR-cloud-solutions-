/** Spreadsheet apps run cells starting with = + - @ as formulas; neutralise them. */
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** A UTF-8 CSV (with BOM, so Excel reads ₹ and names correctly). */
export function csvBody(head: string[], rows: unknown[][]) {
  return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}`;
}

export const csvHeaders = (filename: string) => ({
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
  "Cache-Control": "private, no-store",
});
