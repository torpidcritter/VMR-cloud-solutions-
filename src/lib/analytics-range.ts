import { isIsoDate } from "@/lib/dates";
/** Date ranges for the analytics page, as IST calendar days (YYYY-MM-DD). */

export const ANALYTICS_RANGES = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;

const isDate = (v?: string | null) => isIsoDate(v);

export function analyticsRange(sp: { range?: string; from?: string; to?: string }, now = new Date()) {
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const back = (days: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  if (isDate(sp.from) || isDate(sp.to)) {
    let from = isDate(sp.from) ? sp.from : undefined;
    let to = isDate(sp.to) ? sp.to : undefined;
    if (from && to && from > to) [from, to] = [to, from];
    return { key: "custom", from, to };
  }
  switch (sp.range) {
    case "30d":
      return { key: "30d", from: back(29), to: today };
    case "year":
      return { key: "year", from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { key: "all", from: undefined, to: undefined };
    default:
      return { key: "90d", from: back(89), to: today };
  }
}
