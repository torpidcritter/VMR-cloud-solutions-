import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, FileText, Inbox, Paperclip, Sparkles, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { clientNames, listApplications, openingOptions, recruiterOptions } from "@/lib/data/applications";
import { APPLICATION_SOURCES, APPLICATION_SOURCE_LABELS, APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, DATE_RANGES } from "@/lib/data/constants";
import { ApplicationStatusBadge, Badge, EmptyState, Notice, PageHeader, Pagination, StatCard, formatDateTime, withParams } from "@/components/admin/ui";
import { applicationFilters } from "../../filters";

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 25;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("applications.view");
  const sp = await searchParams;
  const showClient = can(me.role, "openings.viewClient");
  const { filters, search, page } = applicationFilters(sp, showClient, me.id);
  const [{ rows, stats }, openings, clients, recruiters] = await Promise.all([
    listApplications(filters, { page, pageSize: PAGE_SIZE }),
    openingOptions(),
    showClient ? clientNames() : Promise.resolve([] as string[]),
    recruiterOptions(),
  ]);
  const current = { ...search } as Record<string, string | undefined>;
  const url = (changes: Record<string, string | undefined>) => withParams("/admin/applications", current, { page: undefined, ...changes });
  const exportQuery = new URLSearchParams(Object.entries(current).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = Object.values(search).some(Boolean);

  return (
    <>
      {sp.deleted && <Notice tone="green">The application was deleted.</Notice>}
      <PageHeader
        title="Applications"
        description="Every application from job pages, the Careers form and Upload CV."
        actions={
          can(me.role, "applications.export") && (
            <a href={`/admin/api/applications-export${exportQuery ? `?${exportQuery}` : ""}`} className="a-btn">
              <Download aria-hidden className="size-4" /> Export CSV
            </a>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={filtered ? "Matching applications" : "Total applications"} value={stats.total} icon={FileText} href={url({ status: undefined })} />
        <StatCard label="New" value={stats.new} icon={Sparkles} tone="amber" href={url({ status: "new" })} />
        <StatCard label="Screening" value={stats.screening} icon={Inbox} tone="grey" href={url({ status: "screening" })} />
        <StatCard label="Shortlisted to offer" value={stats.shortlisted} icon={Star} tone="violet" href={url({ status: "shortlisted" })} />
        <StatCard label="With resume" value={stats.resumes} icon={Paperclip} tone="cyan" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2" aria-label="Date range">
        {DATE_RANGES.map((r) => {
          const on = (search.range ?? "all") === r.key && !(search.from || search.to);
          return (
            <Link key={r.key} href={url({ range: r.key === "all" ? undefined : r.key, from: undefined, to: undefined })} className="a-chip" aria-current={on}>
              {r.label}
            </Link>
          );
        })}
      </div>

      <form className="card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" defaultValue={search.q} placeholder="Name, email, phone, position or #number" className="a-field" />
        </div>
        <div>
          <label htmlFor="status" className="a-label">
            Status
          </label>
          <select id="status" name="status" defaultValue={search.status ?? ""} className="a-field">
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="a-label">
            Source
          </label>
          <select id="source" name="source" defaultValue={search.source ?? ""} className="a-field">
            <option value="">All sources</option>
            {APPLICATION_SOURCES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="opening" className="a-label">
            Job opening
          </label>
          <select id="opening" name="opening" defaultValue={search.opening ?? ""} className="a-field">
            <option value="">All</option>
            <option value="none">Not linked to an opening</option>
            {openings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.status !== "published" ? ` (${o.status})` : ""}
              </option>
            ))}
          </select>
        </div>
        {showClient ? (
          <div>
            <label htmlFor="client" className="a-label">
              Client
            </label>
            <select id="client" name="client" defaultValue={search.client ?? ""} className="a-field">
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div>
          <label htmlFor="from" className="a-label">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={search.range ? "" : search.from} className="a-field" />
        </div>
        <div>
          <label htmlFor="to" className="a-label">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={search.range ? "" : search.to} className="a-field" />
        </div>
        <div>
          <label htmlFor="assigned" className="a-label">
            Recruiter
          </label>
          <select id="assigned" name="assigned" defaultValue={search.assigned ?? ""} className="a-field">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 lg:col-span-3 lg:justify-end">
          {filtered && (
            <Link href="/admin/applications" className="a-btn">
              Clear
            </Link>
          )}
          <button className="a-btn a-btn-primary">Apply filters</button>
        </div>
      </form>

      <div className="mt-5">
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="a-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Recruiter</th>
                  <th>Resume</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular-nums text-muted">{a.number}</td>
                    <td className="min-w-48">
                      <Link href={`/admin/applications/${a.id}`} className="font-medium hover:text-brand-600">
                        {a.full_name}
                      </Link>
                      {a.candidate_applications > 1 && (
                        <span className="ml-2">
                          <Badge tone="violet">Applied {a.candidate_applications}×</Badge>
                        </span>
                      )}
                      <div className="text-xs text-muted">{a.email}</div>
                      <div className="text-xs text-muted">{a.phone}</div>
                    </td>
                    <td className="min-w-48">
                      {a.position}
                      {a.opening_title && (
                        <div className="text-xs text-muted">
                          {showClient && a.client_name ? a.client_name : a.public_client_label} · {a.opening_location}
                        </div>
                      )}
                      <div className="text-xs text-muted">{a.experience}</div>
                    </td>
                    <td className="whitespace-nowrap text-muted">{APPLICATION_SOURCE_LABELS[a.source]}</td>
                    <td>
                      <ApplicationStatusBadge status={a.status} />
                    </td>
                    <td className="whitespace-nowrap">{a.assigned_name ?? <span className="text-muted">—</span>}</td>
                    <td>
                      {a.resume_path ? (
                        can(me.role, "resumes.download") ? (
                          <a href={`/admin/api/resume/${a.id}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                            <Download aria-hidden className="size-3.5" /> Download
                          </a>
                        ) : (
                          <CheckCircle2 aria-label="Resume on file" className="size-4 text-emerald-600" />
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(a.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={filtered ? "No applications match these filters" : "No applications yet"} icon={FileText}>
            {filtered ? "Try a wider date range or clear the filters." : "Applications from the website will appear here as they arrive."}
          </EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={stats.total} href={(p) => withParams("/admin/applications", current, { page: String(p) })} />
      </div>
    </>
  );
}
