import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listActivity } from "@/lib/data/activity";
import { Badge, PageHeader, Pagination, formatDateTime, type Tone } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;
const TONE: Record<string, Tone> = { create: "green", update: "blue", status: "violet", delete: "red", export: "amber", download: "cyan", note: "grey", signin: "grey", assign: "cyan", merge: "amber" };
const LINK: Record<string, (id: string) => string> = {
  application: (id) => `/admin/applications/${id}`,
  opening: (id) => `/admin/openings/${id}`,
  enquiry: (id) => `/admin/enquiries/${id}`,
  user: (id) => `/admin/users/${id}`,
  candidate: (id) => `/admin/candidates/${id}`,
  interview: (id) => `/admin/interviews/${id}`,
  pool: (id) => `/admin/talent-pools/${id}`,
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin("activity.view");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { rows, total } = await listActivity({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  return (
    <>
      <PageHeader title="Activity" description="Who did what in the admin panel, newest first." />
      <div className="card overflow-x-auto">
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                <td className="whitespace-nowrap">{r.user_name ?? "—"}</td>
                <td>
                  <Badge tone={TONE[r.action] ?? "grey"}>{r.action}</Badge>
                </td>
                <td>
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
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted">
                  Nothing yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/admin/activity?page=${p}`} />
    </>
  );
}
