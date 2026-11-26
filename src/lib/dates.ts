/**
 * True for a real calendar day written YYYY-MM-DD. A pattern check alone lets
 * through days like 2026-02-31, which the database refuses with an error.
 */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
