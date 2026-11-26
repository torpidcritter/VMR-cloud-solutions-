import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Trash2, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPool } from "@/lib/data/talent";
import { listCandidates } from "@/lib/data/candidates";
import { ConfirmButton } from "@/components/admin/forms";
import { EmptyState, PageHeader, Pagination, Panel, formatDate } from "@/components/admin/ui";
import { PriorityBadge, TagList } from "@/components/admin/candidate-ui";
import { PoolForm } from "@/components/admin/talent-ui";
import { deletePoolAction, removeFromPoolAction } from "../../../actions/talent";

export const metadata: Metadata = { title: "Talent pool" };

const PAGE_SIZE = 50;

export default async function PoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const me = await requireAdmin("applications.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pool = await getPool(id);
  if (!pool) notFound();
  const manage = can(me.role, "talent.manage");
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCandidates({ pool: pool.id }, { page, pageSize: PAGE_SIZE, sort: "name" });
  return (
    <>
      <Link href="/admin/talent-pools" className="text-sm text-muted hover:text-brand-600">
        ← Talent pools
      </Link>
      <PageHeader
        title={pool.name}
        description={pool.description || `${pool.members} candidate${pool.members === 1 ? "" : "s"}`}
        actions={
          <Link href={`/admin/candidates?pool=${pool.id}`} className="a-btn">
            <Search aria-hidden className="size-4" /> Search within this pool
          </Link>
        }
      />
      <div className={`grid grid-cols-1 gap-6 ${manage ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
        <div className="min-w-0">
          {rows.length ? (
            <div className="card relative overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Skills</th>
                    <th>Experience</th>
                    <th>Last contacted</th>
                    {manage && (
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="min-w-48">
                        <Link href={`/admin/candidates/${c.id}`} className="font-medium hover:text-brand-600">
                          {c.full_name}
                        </Link>
                        {c.priority !== "normal" && (
                          <span className="ml-2">
                            <PriorityBadge priority={c.priority} />
                          </span>
                        )}
                        <div className="text-xs text-muted">{[c.current_title || c.specialisation, c.location].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="min-w-44 max-w-72">
                        <TagList items={c.skills.slice(0, 4)} more={c.skills.length - 4} />
                      </td>
                      <td className="whitespace-nowrap">
                        {c.experience_years != null ? `${c.experience_years} yrs` : c.experience || <span className="text-muted">—</span>}
                        {c.availability && <div className="text-xs text-muted">{c.availability}</div>}
                      </td>
                      <td className="whitespace-nowrap text-muted">{c.last_contacted_at ? formatDate(c.last_contacted_at) : "Never"}</td>
                      {manage && (
                        <td className="text-right">
                          <form action={removeFromPoolAction}>
                            <input type="hidden" name="poolId" value={pool.id} />
                            <input type="hidden" name="candidateId" value={c.id} />
                            <button className="a-btn !px-2" aria-label={`Remove ${c.full_name} from this pool`}>
                              <X aria-hidden className="size-4" />
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No one in this pool yet">Add candidates from their profile, or search candidates and add everyone who matches.</EmptyState>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/admin/talent-pools/${pool.id}?page=${p}`} />
        </div>
        {manage && (
          <div className="grid content-start gap-6">
            <Panel title="Pool details">
              <PoolForm pool={pool} />
            </Panel>
            <Panel title="Delete">
              <p className="mb-3 text-sm text-muted">Removes the pool only. Its candidates stay in the Talent Bank.</p>
              <ConfirmButton
                action={deletePoolAction}
                hidden={{ id: pool.id }}
                title="Delete this pool?"
                confirmLabel="Delete pool"
                confirm={`${pool.name} will be deleted. The ${pool.members} candidate${pool.members === 1 ? "" : "s"} in it stay in the Talent Bank.`}
              >
                <Trash2 aria-hidden className="size-4" /> Delete pool
              </ConfirmButton>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
