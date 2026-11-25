import { dateRange } from "@/lib/data/constants";
import type { ApplicationFilters } from "@/lib/data/applications";

export type ApplicationSearch = { q?: string; status?: string; source?: string; opening?: string; client?: string; range?: string; from?: string; to?: string; page?: string };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);

/** Reads the applications filters from the URL. `client` only for roles that may see client names. */
export function applicationFilters(sp: Record<string, string | string[] | undefined>, allowClient: boolean): { filters: ApplicationFilters; search: ApplicationSearch; page: number } {
  const search: ApplicationSearch = {
    q: one(sp.q),
    status: one(sp.status),
    source: one(sp.source),
    opening: one(sp.opening),
    client: allowClient ? one(sp.client) : undefined,
    range: one(sp.range),
    from: one(sp.from),
    to: one(sp.to),
  };
  const range = search.range && search.range !== "custom" ? dateRange(search.range) : { from: search.from, to: search.to };
  return {
    filters: { q: search.q, status: search.status, source: search.source, opening: search.opening, client: search.client, from: range.from, to: range.to },
    search,
    page: Math.max(1, Math.min(10_000, Number(one(sp.page)) || 1)),
  };
}
