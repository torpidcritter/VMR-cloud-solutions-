import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageSquare, PhoneCall, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listEnquiries } from "@/lib/data/enquiries";
import { DATE_RANGES, ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS, dateRange } from "@/lib/data/constants";
import { EmptyState, EnquiryStatusBadge, Notice, PageHeader, Pagination, StatCard, formatDateTime, withParams } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Enquiries" };

const PAGE_SIZE = 25;
const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("enquiries.view");
  const sp = await searchParams;
  const search = { q: one(sp.q), status: one(sp.status), range: one(sp.range) };
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { rows, stats } = await listEnquiries({ q: search.q, status: search.status, ...dateRange(search.range ?? "all") }, { page, pageSize: PAGE_SIZE });
  const url = (changes: Record<string, string | undefined>) => withParams("/admin/enquiries", search, { ...changes });
  const filtered = Object.values(search).some(Boolean);

  return (
    <>
      {sp.deleted && <Notice tone="green">The enquiry was deleted.</Notice>}
      <PageHeader title="Enquiries" description="Business enquiries from the Contact page." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={filtered ? "Matching enquiries" : "Total enquiries"} value={stats.total} icon={MessageSquare} href={url({ status: undefined })} />
        <StatCard label="New" value={stats.new} icon={Sparkles} tone="amber" href={url({ status: "new" })} />
        <StatCard label="Contacted" value={stats.contacted} icon={PhoneCall} tone="cyan" href={url({ status: "contacted" })} />
        <StatCard label="Converted" value={stats.converted} icon={CheckCircle2} tone="green" href={url({ status: "converted" })} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {DATE_RANGES.map((r) => (
          <Link key={r.key} href={url({ range: r.key === "all" ? undefined : r.key })} className="a-chip" aria-current={(search.range ?? "all") === r.key}>
            {r.label}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-center gap-2" role="search">
          {search.range && <input type="hidden" name="range" value={search.range} />}
          <select name="status" defaultValue={search.status ?? ""} aria-label="Status" className="a-field !w-40">
            <option value="">All statuses</option>
            {ENQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ENQUIRY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={search.q} aria-label="Search" placeholder="Name, company, email…" className="a-field !w-60" />
          <button className="a-btn">Search</button>
        </form>
      </div>

      <div className="mt-5">
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="a-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>From</th>
                  <th>Service</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="tabular-nums text-muted">{e.number}</td>
                    <td className="min-w-48">
                      <Link href={`/admin/enquiries/${e.id}`} className="font-medium hover:text-brand-600">
                        {e.name}
                      </Link>
                      {e.company && <div className="text-xs text-muted">{e.company}</div>}
                      <div className="text-xs text-muted">{e.email}</div>
                    </td>
                    <td className="min-w-40">
                      {e.service}
                      {e.requirement && <div className="text-xs text-muted">{e.requirement}</div>}
                    </td>
                    <td className="max-w-sm">
                      <p className="line-clamp-2 text-ink-soft">{e.message}</p>
                    </td>
                    <td>
                      <EnquiryStatusBadge status={e.status} />
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={filtered ? "No enquiries match" : "No enquiries yet"} icon={MessageSquare}>
            {filtered ? "Try another filter." : "Messages sent from the Contact page will appear here."}
          </EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={stats.total} href={(p) => withParams("/admin/enquiries", search, { page: String(p) })} />
      </div>
    </>
  );
}
