import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, FileText, Inbox, MessageSquare, Sparkles, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { dashboardStats } from "@/lib/data/dashboard";
import { APPLICATION_SOURCE_LABELS } from "@/lib/data/constants";
import { ApplicationStatusBadge, EmptyState, Notice, PageHeader, Panel, StatCard, formatDateTime } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string; password?: string }> }) {
  const me = await requireAdmin("dashboard.view");
  const sp = await searchParams;
  const s = await dashboardStats();
  const max = Math.max(1, ...s.weekly.map((w) => w.count));
  const first = me.name.split(/\s+/)[0];

  return (
    <>
      {sp.denied && <Notice tone="amber">Your role doesn&apos;t have access to that page.</Notice>}
      {sp.password && <Notice tone="green">Your password has been changed.</Notice>}
      <PageHeader
        title={`Welcome, ${first}`}
        description="Live figures from the website: applications, openings and enquiries."
        actions={
          can(me.role, "openings.edit") && (
            <Link href="/admin/openings/new" className="a-btn a-btn-primary">
              Post a job opening
            </Link>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applications" value={s.applications.total} icon={FileText} href="/admin/applications" hint={`${s.applications.last7} in the last 7 days`} />
        <StatCard label="New, not yet reviewed" value={s.applications.new} icon={Sparkles} tone="amber" href="/admin/applications?status=new" />
        <StatCard label="Shortlisted to offered" value={s.applications.shortlisted} icon={CheckCircle2} tone="violet" href="/admin/applications?status=shortlisted" />
        <StatCard label="Hired" value={s.applications.hired} icon={CheckCircle2} tone="green" href="/admin/applications?status=hired" />
        <StatCard label="Live job openings" value={s.openings.published} icon={BriefcaseBusiness} tone="cyan" href="/admin/openings?status=published" hint={`${s.openings.draft} in draft`} />
        <StatCard label="Candidates in talent bank" value={s.talent.candidates} icon={Users} tone="blue" href="/admin/talent" hint={`${s.talent.resumes} resumes on file`} />
        <StatCard label="New enquiries" value={s.enquiries.new} icon={MessageSquare} tone="red" href="/admin/enquiries?status=new" hint={`${s.enquiries.total} in total`} />
        <StatCard label="Under review" value={s.applications.under_review} icon={Inbox} tone="grey" href="/admin/applications?status=under_review" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Applications per week (last 12 weeks)">
          <figure>
            <div className="flex h-48 items-end gap-1.5 sm:gap-2.5" role="img" aria-label={s.weekly.map((w) => `Week of ${w.week}: ${w.count}`).join(", ")}>
              {s.weekly.map((w) => (
                <div key={w.week} className="group flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-xs tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{w.count}</span>
                  <div
                    className="rounded-t-md bg-brand-500 transition-colors group-hover:bg-brand-600"
                    style={{ height: `${Math.max(w.count ? 6 : 2, (w.count / max) * 100)}%`, opacity: w.count ? 1 : 0.25 }}
                  />
                </div>
              ))}
            </div>
            <figcaption className="mt-2 flex justify-between text-xs text-muted">
              <span>{fmtWeek(s.weekly[0]?.week)}</span>
              <span>This week: {s.weekly.at(-1)?.count ?? 0}</span>
            </figcaption>
          </figure>
        </Panel>

        <Panel title="Live openings" actions={<Link href="/admin/openings" className="text-sm text-brand-600">All openings</Link>} bodyClass="">
          {s.topOpenings.length ? (
            <ul className="divide-y divide-line">
              {s.topOpenings.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/admin/applications?opening=${o.id}`} className="min-w-0 truncate text-sm font-medium hover:text-brand-600">
                    {o.title}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {o.applications} {o.new_applications > 0 && <span className="font-semibold text-brand-600">· {o.new_applications} new</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">No live openings. Published jobs show here with their application counts.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Latest applications" actions={<Link href="/admin/applications" className="text-sm text-brand-600">View all</Link>} bodyClass="overflow-x-auto">
          {s.recent.length ? (
            <table className="a-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular-nums text-muted">{a.number}</td>
                    <td>
                      <Link href={`/admin/applications/${a.id}`} className="font-medium hover:text-brand-600">
                        {a.full_name}
                      </Link>
                    </td>
                    <td>{a.position}</td>
                    <td className="text-muted">{APPLICATION_SOURCE_LABELS[a.source as keyof typeof APPLICATION_SOURCE_LABELS] ?? a.source}</td>
                    <td>
                      <ApplicationStatusBadge status={a.status} />
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(a.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-5">
              <EmptyState title="No applications yet" icon={FileText}>
                Applications from the Careers page, job pages and Upload CV will appear here as they arrive.
              </EmptyState>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function fmtWeek(w?: string) {
  if (!w) return "";
  return `From ${new Date(`${w}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}
