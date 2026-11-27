import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listOpenings } from "@/lib/data/openings";
import { OPENING_STATUSES, OPENING_STATUS_LABELS } from "@/lib/data/constants";
import { EmptyState, Notice, OpeningStatusBadge, PageHeader, formatDate, withParams } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Job Openings" };

export default async function OpeningsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; deleted?: string }> }) {
  const me = await requireAdmin("openings.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const rows = await listOpenings({ status: sp.status, q });
  const showClient = can(me.role, "openings.viewClient");
  const editable = can(me.role, "openings.edit");
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  return (
    <>
      {sp.deleted && <Notice tone="green">The opening was deleted. Its applications are kept.</Notice>}
      <PageHeader
        title="Job Openings"
        description="Published openings appear on the Careers page. The client name stays private; the website shows the public label."
        actions={
          editable && (
            <Link href="/admin/openings/new" className="a-btn a-btn-primary">
              New opening
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={withParams("/admin/openings", { q }, { status: undefined })} className="a-chip" aria-current={!sp.status}>
          All
        </Link>
        {OPENING_STATUSES.map((s) => (
          <Link key={s} href={withParams("/admin/openings", { q }, { status: s })} className="a-chip" aria-current={sp.status === s}>
            {OPENING_STATUS_LABELS[s]}
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2" role="search">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <label className="relative">
            <span className="sr-only">Search openings</span>
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Title, module, location…" className="a-field !w-64 pl-8" />
          </label>
          <button className="a-btn">Search</button>
        </form>
      </div>

      {rows.length ? (
        <div className="card overflow-x-auto">
          <table className="a-table">
            <thead>
              <tr>
                <th>Title</th>
                {showClient && <th>Client</th>}
                <th>Location</th>
                <th>Status</th>
                <th>Recruiters</th>
                <th className="text-right">Applications</th>
                <th>Closes</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const expired = o.status === "published" && o.closing_date && o.closing_date < today;
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/openings/${o.id}`} className="font-medium hover:text-brand-600">
                        {o.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {[o.sap_module, o.employment_type, o.experience].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    {showClient && (
                      <td>
                        {o.client_name || <span className="text-muted">—</span>}
                        <div className="text-xs text-muted">Shown as: {o.public_client_label}</div>
                      </td>
                    )}
                    <td>
                      {o.location}
                      <div className="text-xs text-muted">{o.work_mode}</div>
                    </td>
                    <td>
                      <OpeningStatusBadge status={o.status} />
                      {expired && <div className="mt-1 text-xs text-accent-600">Past closing date, hidden</div>}
                    </td>
                    <td>
                      {o.recruiter_names.length ? o.recruiter_names.join(", ") : <span className="text-muted">None</span>}
                      <div className="text-xs text-muted">
                        {o.vacancies} position{o.vacancies === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">
                      <Link href={`/admin/applications?opening=${o.id}`} className="hover:text-brand-600">
                        {o.applications}
                        {o.new_applications > 0 && <span className="ml-1 text-xs font-semibold text-brand-600">({o.new_applications} new)</span>}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-muted">{o.closing_date ? formatDate(`${o.closing_date}T00:00:00+05:30`) : "—"}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(o.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={q || sp.status ? "No openings match" : "No job openings yet"} icon={BriefcaseBusiness}>
          {q || sp.status ? "Try another filter." : "Post your first opening and it will appear on the Careers page as soon as you publish it."}
        </EmptyState>
      )}
    </>
  );
}
