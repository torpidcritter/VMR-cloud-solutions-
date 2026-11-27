import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Clock, Download, FileText, Timer, UserCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { analytics, type Breakdown } from "@/lib/data/analytics";
import { ANALYTICS_RANGES, analyticsRange } from "@/lib/analytics-range";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { PageHeader, Panel, StatCard, formatDate, withParams } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Analytics" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 20) : undefined);
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const fmtWeek = (w?: string) => (w ? new Date(`${w}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

function BreakdownTable({ rows, label, link, empty }: { rows: Breakdown[]; label: string; link?: (key: string) => string | null; empty: string }) {
  if (!rows.length) return <p className="px-5 py-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="a-table">
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col" className="text-right">
              Applied
            </th>
            <th scope="col" className="text-right">
              Shortlisted
            </th>
            <th scope="col" className="text-right">
              Interviewed
            </th>
            <th scope="col" className="text-right">
              Hired
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = link?.(r.key) ?? null;
            return (
              <tr key={r.key}>
                <td className="min-w-36">
                  {href ? (
                    <Link href={href} className="font-medium hover:text-brand-600">
                      {r.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.label}</span>
                  )}
                </td>
                <td className="text-right tabular-nums">{r.applications}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {r.shortlisted} <span className="text-xs text-muted">{pct(r.shortlisted, r.applications)}</span>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {r.interviewed} <span className="text-xs text-muted">{pct(r.interviewed, r.applications)}</span>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {r.hired} <span className="text-xs text-muted">{pct(r.hired, r.applications)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("analytics.view");
  const sp = await searchParams;
  const range = analyticsRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) });
  const withClients = can(me.role, "openings.viewClient") && can(me.role, "clients.view");
  const a = await analytics({ from: range.from, to: range.to }, { withClients });
  const q = new URLSearchParams(Object.entries({ from: range.from, to: range.to }).filter(([, v]) => v) as [string, string][]).toString();
  const csv = (section: string) => (
    <a href={`/admin/api/analytics-export?section=${section}${q ? `&${q}` : ""}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
      <Download aria-hidden className="size-3.5" /> CSV
    </a>
  );
  const appsLink = (extra: Record<string, string>) => withParams("/admin/applications", { from: range.from, to: range.to }, extra);
  const max = Math.max(1, ...a.weekly.map((w) => w.count));
  const funnelMax = Math.max(1, a.funnel.total);
  const hiresBy = new Map(a.recruiterHires.map((h) => [h.key, h.hires]));
  const label = range.from || range.to ? `${range.from ? formatDate(range.from) : "the start"} to ${range.to ? formatDate(range.to) : "today"}` : "all time";

  return (
    <>
      <PageHeader title="Analytics" description={`Recruitment figures for ${label}. Applications count by the day they arrived; hires by the day they were marked Hired.`} />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {ANALYTICS_RANGES.map((r) => (
            <Link key={r.key} href={r.key === "90d" ? "/admin/analytics" : `/admin/analytics?range=${r.key}`} className="a-chip" aria-current={range.key === r.key}>
              {r.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2 sm:ml-auto">
          <div>
            <label htmlFor="an-from" className="a-label">
              From
            </label>
            <input id="an-from" name="from" type="date" defaultValue={range.key === "custom" ? range.from : ""} className="a-field !py-1.5" />
          </div>
          <div>
            <label htmlFor="an-to" className="a-label">
              To
            </label>
            <input id="an-to" name="to" type="date" defaultValue={range.key === "custom" ? range.to : ""} className="a-field !py-1.5" />
          </div>
          <button className="a-btn">Show</button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Applications" value={a.funnel.total} icon={FileText} href={appsLink({})} />
        <StatCard label="Hires" value={a.hire.hires} icon={UserCheck} tone="green" hint="Marked Hired" />
        <StatCard
          label="Time to hire"
          value={a.hire.avgDays === null ? "—" : `${a.hire.avgDays} days`}
          icon={Timer}
          tone="violet"
          hint={a.hire.medianDays === null ? "No hires yet" : `Average · median ${a.hire.medianDays} d`}
        />
        <StatCard
          label="First response"
          value={a.firstAction.avgHours === null ? "—" : a.firstAction.avgHours < 48 ? `${a.firstAction.avgHours} h` : `${Math.round(a.firstAction.avgHours / 2.4) / 10} days`}
          icon={Clock}
          tone="amber"
          hint={`${a.firstAction.waiting} still waiting in New`}
        />
        <StatCard label="Interviews" value={a.interviews.total} icon={CalendarClock} tone="cyan" hint={`${a.interviews.completed} done · ${a.interviews.noShow} no-show`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Applications per week">
          <figure>
            <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={a.weekly.map((w) => `Week of ${fmtWeek(w.week)}: ${w.count}`).join(", ")}>
              {a.weekly.map((w) => (
                <div key={w.week} className="group flex h-full max-w-12 flex-1 flex-col justify-end" title={`Week of ${fmtWeek(w.week)}: ${w.count}`}>
                  <span className="mb-1 text-center text-[0.65rem] tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{w.count}</span>
                  <div className="rounded-t-md bg-brand-500 group-hover:bg-brand-600" style={{ height: `${Math.max(w.count ? 6 : 2, (w.count / max) * 100)}%`, opacity: w.count ? 1 : 0.25 }} />
                </div>
              ))}
            </div>
            <figcaption className="mt-2 flex justify-between text-xs text-muted">
              <span>Week of {fmtWeek(a.weekly[0]?.week)}</span>
              {a.weekly.length > 1 && <span>Week of {fmtWeek(a.weekly.at(-1)?.week)}</span>}
            </figcaption>
          </figure>
        </Panel>

        <Panel title="Conversion" actions={csv("funnel")}>
          <ol className="grid gap-2">
            {a.funnel.stages.map((s, i) => (
              <li key={s.stage} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-muted">{APPLICATION_STATUS_LABELS[s.stage]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(s.count / funnelMax) * 100}%` }} />
                </span>
                <span className="w-24 text-right tabular-nums">
                  {s.count} <span className="text-xs text-muted">{i === 0 ? "" : pct(s.count, a.funnel.total)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Everyone who reached each stage, even if they moved on or were rejected later. {a.funnel.rejected} rejected and {a.funnel.onHold} on hold now.
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="By source" actions={csv("sources")} bodyClass="">
          <BreakdownTable
            rows={a.sources.map((r) => ({ ...r, label: APPLICATION_SOURCE_LABELS[r.key as keyof typeof APPLICATION_SOURCE_LABELS] ?? r.label }))}
            label="Source"
            link={(k) => appsLink({ source: k })}
            empty="No applications in this period."
          />
        </Panel>
        <Panel title="By recruiter" actions={csv("recruiters")} bodyClass="">
          {a.recruiters.length ? (
            <div className="relative overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col">Recruiter</th>
                    <th scope="col" className="text-right">
                      Assigned
                    </th>
                    <th scope="col" className="text-right">
                      Shortlisted
                    </th>
                    <th scope="col" className="text-right">
                      Hires made
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.recruiters.map((r) => (
                    <tr key={r.key}>
                      <td className="min-w-40">
                        <Link href={appsLink({ assigned: r.key })} className="font-medium hover:text-brand-600">
                          {r.label}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{r.applications}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {r.shortlisted} <span className="text-xs text-muted">{pct(r.shortlisted, r.applications)}</span>
                      </td>
                      <td className="text-right tabular-nums">{hiresBy.get(r.key) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No applications in this period.</p>
          )}
          <p className="border-t border-line px-5 py-2.5 text-xs text-muted">Assigned and shortlisted count applications that arrived in the period. Hires made count hires marked in the period.</p>
        </Panel>
        <Panel title="By job opening" actions={csv("openings")} bodyClass="">
          <BreakdownTable rows={a.openings} label="Opening" link={(k) => appsLink({ opening: k })} empty="No applications in this period." />
        </Panel>
        {a.clients && (
          <Panel title="By client" actions={csv("clients")} bodyClass="">
            <BreakdownTable rows={a.clients} label="Client" link={(k) => (k === "none" ? null : `/admin/clients/${k}`)} empty="No applications for client openings in this period." />
          </Panel>
        )}
        <Panel title="Skill demand" actions={csv("skills")} bodyClass="">
          {a.skills.length ? (
            <div className="relative overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col">Skill</th>
                    <th scope="col" className="text-right">
                      Open roles asking
                    </th>
                    <th scope="col" className="text-right">
                      Profiles with it
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.skills.map((s) => (
                    <tr key={s.skill}>
                      <td>
                        <Link href={`/admin/candidates?skill=${encodeURIComponent(s.skill)}`} className="font-medium hover:text-brand-600">
                          {s.skill}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{s.openings}</td>
                      <td className={`text-right tabular-nums ${s.candidates < s.openings * 3 ? "font-semibold text-accent-600" : ""}`}>{s.candidates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No open roles list skills yet.</p>
          )}
          <p className="border-t border-line px-5 py-2.5 text-xs text-muted">Skills on openings that aren&apos;t closed (any date). Red means fewer than three profiles per role asking: a sourcing gap.</p>
        </Panel>
      </div>
    </>
  );
}
