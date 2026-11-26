import type { Metadata } from "next";
import Link from "next/link";
import { FolderHeart } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listPools } from "@/lib/data/talent";
import { EmptyState, Notice, PageHeader, Panel, formatDate } from "@/components/admin/ui";
import { PoolForm } from "@/components/admin/talent-ui";

export const metadata: Metadata = { title: "Talent pools" };

export default async function TalentPoolsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const me = await requireAdmin("applications.view");
  const sp = await searchParams;
  const pools = await listPools();
  const manage = can(me.role, "talent.manage");
  return (
    <>
      <PageHeader title="Talent pools" description="Named shortlists of candidates to come back to, such as S/4HANA FICO in Bengaluru or ABAP contractors free in January." />
      {sp.deleted === "1" && <Notice tone="green">The pool was deleted. Its candidates are still in the Talent Bank.</Notice>}
      <div className={`grid grid-cols-1 gap-6 ${manage ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
        <div className="min-w-0">
          {pools.length ? (
            <div className="card overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Pool</th>
                    <th className="text-right">Candidates</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((p) => (
                    <tr key={p.id}>
                      <td className="min-w-56">
                        <Link href={`/admin/talent-pools/${p.id}`} className="font-medium hover:text-brand-600">
                          {p.name}
                        </Link>
                        {p.description && <div className="line-clamp-2 text-xs text-muted">{p.description}</div>}
                      </td>
                      <td className="text-right tabular-nums">{p.members}</td>
                      <td className="whitespace-nowrap text-muted">
                        {formatDate(p.created_at)}
                        {p.created_by_name ? ` · ${p.created_by_name}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No talent pools yet" icon={FolderHeart}>
              {manage ? "Create one, then add candidates from their profile or from a candidate search." : "Recruiters create pools to group candidates for later."}
            </EmptyState>
          )}
        </div>
        {manage && (
          <Panel title="New pool">
            <PoolForm />
          </Panel>
        )}
      </div>
    </>
  );
}
