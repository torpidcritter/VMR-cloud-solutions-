import { dateRange } from "@/lib/data/constants";
import type { ApplicationFilters } from "@/lib/data/applications";
import { applicationIdsMatching } from "@/lib/data/bulk";

export type ApplicationSearch = { q?: string; status?: string; source?: string; opening?: string; client?: string; assigned?: string; range?: string; from?: string; to?: string; page?: string };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);

/** Reads the applications filters from the URL. `client` only for roles that may see client names. */
export function applicationFilters(sp: Record<string, string | string[] | undefined>, allowClient: boolean, meId?: string): { filters: ApplicationFilters; search: ApplicationSearch; page: number } {
  const search: ApplicationSearch = {
    q: one(sp.q),
    status: one(sp.status),
    source: one(sp.source),
    opening: one(sp.opening),
    client: allowClient ? one(sp.client) : undefined,
    assigned: one(sp.assigned),
    range: one(sp.range),
    from: one(sp.from),
    to: one(sp.to),
  };
  const range = search.range && search.range !== "custom" ? dateRange(search.range) : { from: search.from, to: search.to };
  return {
    filters: { q: search.q, status: search.status, source: search.source, opening: search.opening, client: search.client, assigned: search.assigned === "me" ? meId : search.assigned, from: range.from, to: range.to },
    search,
    page: Math.max(1, Math.min(10_000, Number(one(sp.page)) || 1)),
  };
}

/**
 * The applications a bulk request is about: either the ids picked on the page
 * (`ids`, comma separated) or, with `all=1`, everything matching the filters
 * sent as `f_<name>` fields, newest first and capped.
 */
export async function bulkSelection(form: FormData, allowClient: boolean, meId: string, cap: number): Promise<string[]> {
  if (form.get("all") === "1") {
    const sp: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("f_") && typeof v === "string") sp[k.slice(2)] = v;
    const { filters } = applicationFilters(sp, allowClient, meId);
    return applicationIdsMatching(filters, cap);
  }
  const raw = String(form.get("ids") ?? "");
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))].slice(0, cap);
}
