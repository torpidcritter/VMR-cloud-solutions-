import type { Metadata } from "next";
import Link from "next/link";
import { Download, KeyRound, ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { LOGIN_OUTCOMES, LOGIN_OUTCOME_LABELS, activityFacets, listActivity, listLogins, recentFailedLogins, type LoginOutcome } from "@/lib/data/audit";
import { getSettings } from "@/lib/data/settings";
import { Badge, Notice, PageHeader, Pagination, StatCard, formatDateTime, withParams, type Tone } from "@/components/admin/ui";
import { auditFilters } from "../../audit-filters";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;
const TONE: Record<string, Tone> = { create: "green", update: "blue", status: "violet", delete: "red", export: "amber", download: "cyan", note: "grey", signin: "grey", assign: "cyan", merge: "amber", view: "grey", email: "blue" };
const OUTCOME_TONE: Record<LoginOutcome, Tone> = { success: "green", signout: "grey", bad_password: "amber", unknown: "amber", locked: "red", inactive: "red", rate_limited: "red" };
const ENTITY_LABEL: Record<string, string> = {
  application: "Applications",
  candidate: "Candidates",
  client: "Clients",
  email_template: "Email templates",
  enquiry: "Enquiries",
  interview: "Interviews",
  opening: "Job openings",
  pool: "Talent pools",
  settings: "Settings",
  task: "Tasks",
  user: "Users",
};
const LINK: Record<string, (id: string) => string> = {
  application: (id) => `/admin/applications/${id}`,
  opening: (id) => `/admin/openings/${id}`,
  enquiry: (id) => `/admin/enquiries/${id}`,
  user: (id) => `/admin/users/${id}`,
  candidate: (id) => `/admin/candidates/${id}`,
  interview: (id) => `/admin/interviews/${id}`,
  pool: (id) => `/admin/talent-pools/${id}`,
  client: (id) => `/admin/clients/${id}`,
  email_template: () => "/admin/settings/email-templates",
};
/** Short device description from a user agent, without storing anything new. */
function device(ua: string) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("activity.view");
  const sp = await searchParams;
  const { tab, activity, logins, search, page } = auditFilters(sp);
  const offset = (page - 1) * PAGE_SIZE;
  const [facets, failed24h, settings, act, log] = await Promise.all([
    activityFacets(),
    recentFailedLogins(),
    getSettings(),
    tab === "activity" ? listActivity(activity, { limit: PAGE_SIZE, offset }) : Promise.resolve(null),
    tab === "signins" ? listLogins(logins, { limit: PAGE_SIZE, offset }) : Promise.resolve(null),
  ]);
  const url = (changes: Record<string, string | undefined>) => withParams("/admin/activity", search, { page: undefined, ...changes });
  const filtered = Object.entries(search).some(([k, v]) => k !== "tab" && v);
  const exportQuery = new URLSearchParams(Object.entries(search).filter(([, v]) => v) as [string, string][]).toString();
  const total = act?.total ?? log?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Activity"
        description={`Who did what in the admin panel, and every sign-in attempt. Entries are kept for ${settings.auditRetentionDays} days.`}
        actions={
          <a href={`/admin/api/activity-export?${exportQuery}`} className="a-btn">
            <Download aria-hidden className="size-4" /> Export CSV
          </a>
        }
      />
      {activity.entityId && tab === "activity" && <Notice tone="blue">Showing the history of one record. <Link href={url({ id: undefined, entity: undefined })} className="underline">Show everything</Link></Notice>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Failed sign-ins, last 24 hours" value={failed24h} icon={ShieldAlert} tone={failed24h ? "red" : "green"} href="/admin/activity?tab=signins&outcome=failed" />
        <StatCard label={tab === "signins" ? "Sign-in records shown" : "Entries shown"} value={total.toLocaleString("en-IN")} icon={KeyRound} tone="grey" />
      </div>

      <nav aria-label="Audit views" className="mt-6 flex gap-2">
        <Link href="/admin/activity" className="a-chip" aria-current={tab === "activity"}>
          Changes and views
        </Link>
        <Link href="/admin/activity?tab=signins" className="a-chip" aria-current={tab === "signins"}>
          Sign-ins
        </Link>
      </nav>

      <form className="card mt-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        {tab === "signins" && <input type="hidden" name="tab" value="signins" />}
        {tab === "activity" && activity.entityId && <input type="hidden" name="id" value={activity.entityId} />}
        <div className="lg:col-span-2">
          <label htmlFor="q" className="a-label">
            {tab === "signins" ? "Email or IP address" : "Search the details"}
          </label>
          <input id="q" name="q" defaultValue={search.q} className="a-field" />
        </div>
        <div>
          <label htmlFor="user" className="a-label">
            Person
          </label>
          <select id="user" name="user" defaultValue={search.user ?? ""} className="a-field">
            <option value="">Anyone</option>
            {facets.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.active ? "" : " (deactivated)"}
              </option>
            ))}
          </select>
        </div>
        {tab === "signins" ? (
          <div>
            <label htmlFor="outcome" className="a-label">
              Result
            </label>
            <select id="outcome" name="outcome" defaultValue={search.outcome ?? ""} className="a-field">
              <option value="">Any result</option>
              <option value="failed">Any failure</option>
              {LOGIN_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {LOGIN_OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="action" className="a-label">
                Action
              </label>
              <select id="action" name="action" defaultValue={search.action ?? ""} className="a-field">
                <option value="">Any action</option>
                {facets.actions.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="entity" className="a-label">
                Record type
              </label>
              <select id="entity" name="entity" defaultValue={search.entity ?? ""} className="a-field">
                <option value="">Any record</option>
                {facets.entities.map((e) => (
                  <option key={e} value={e}>
                    {ENTITY_LABEL[e] ?? e}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="from" className="a-label">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={search.from} className="a-field" />
        </div>
        <div>
          <label htmlFor="to" className="a-label">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={search.to} className="a-field" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          {filtered && (
            <Link href={tab === "signins" ? "/admin/activity?tab=signins" : "/admin/activity"} className="a-btn">
              Clear
            </Link>
          )}
          <button className="a-btn a-btn-primary">Apply filters</button>
        </div>
      </form>

      <div className="card relative mt-5 overflow-x-auto">
        {act && (
          <table className="a-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {act.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                  <td className="whitespace-nowrap">{r.user_id ? <Link href={url({ user: r.user_id })} className="hover:text-brand-600">{r.user_name ?? "—"}</Link> : "—"}</td>
                  <td>
                    <Badge tone={TONE[r.action] ?? "grey"}>{r.action}</Badge>
                  </td>
                  <td className="min-w-64">
                    {r.entity_id && LINK[r.entity] && r.action !== "delete" ? (
                      <Link href={LINK[r.entity](r.entity_id)} className="hover:text-brand-600">
                        {r.summary}
                      </Link>
                    ) : (
                      r.summary
                    )}
                  </td>
                </tr>
              ))}
              {!act.rows.length && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted">
                    {filtered ? "Nothing matches these filters." : "Nothing yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {log && (
          <table className="a-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Result</th>
                <th>Account</th>
                <th>IP address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {log.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                  <td className="whitespace-nowrap">
                    <Badge tone={OUTCOME_TONE[r.outcome] ?? "grey"}>{LOGIN_OUTCOME_LABELS[r.outcome] ?? r.outcome}</Badge>
                  </td>
                  <td className="min-w-48">
                    {r.user_name && <div className="font-medium">{r.user_name}</div>}
                    <div className="text-xs text-muted">{r.email}</div>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{r.ip || "—"}</td>
                  <td className="whitespace-nowrap text-muted" title={r.user_agent}>
                    {device(r.user_agent) || "—"}
                  </td>
                </tr>
              ))}
              {!log.rows.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    {filtered ? "No sign-ins match these filters." : "No sign-ins recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => withParams("/admin/activity", search, { page: String(p) })} />
    </>
  );
}
