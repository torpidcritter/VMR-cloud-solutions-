import type { AuditFilters, LoginFilters } from "@/lib/data/audit";

const one = (v: unknown, max = 100) => (typeof v === "string" && v ? v.slice(0, max) : undefined);

/** Reads the Activity page filters from the URL (shared with the CSV export). */
export function auditFilters(sp: Record<string, string | string[] | undefined>) {
  const tab: "activity" | "signins" = sp.tab === "signins" ? "signins" : "activity";
  const activity: AuditFilters = { user: one(sp.user, 40), action: one(sp.action, 30), entity: one(sp.entity, 30), entityId: one(sp.id, 40), q: one(sp.q), from: one(sp.from, 10), to: one(sp.to, 10) };
  const logins: LoginFilters = { user: one(sp.user, 40), outcome: one(sp.outcome, 20), q: one(sp.q), from: one(sp.from, 10), to: one(sp.to, 10) };
  const search: Record<string, string | undefined> = tab === "signins" ? { tab, ...logins } : { ...activity, id: activity.entityId, entityId: undefined };
  return { tab, activity, logins, search, page: Math.max(1, Math.min(10_000, Number(one(sp.page, 6)) || 1)) };
}
