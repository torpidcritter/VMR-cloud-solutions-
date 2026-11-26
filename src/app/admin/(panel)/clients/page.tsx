import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listClients, managerOptions } from "@/lib/data/clients";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from "@/lib/data/constants";
import { ClientStatusBadge, EmptyState, Notice, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Clients" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 100) : undefined);

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("clients.view");
  const sp = await searchParams;
  const search = { q: one(sp.q), status: one(sp.status), manager: one(sp.manager) };
  const [rows, managers] = await Promise.all([listClients(search), managerOptions()]);
  const filtered = Object.values(search).some(Boolean);
  const editable = can(me.role, "clients.edit");

  return (
    <>
      {sp.deleted && <Notice tone="green">The client was deleted.</Notice>}
      <PageHeader
        title="Clients"
        description="Companies you recruit for, with their contacts, open requirements and the openings filled for them. Confidential: none of this appears on the website."
        actions={
          editable ? (
            <Link href="/admin/clients/new" className="a-btn a-btn-primary">
              <Plus aria-hidden className="size-4" /> Add client
            </Link>
          ) : undefined
        }
      />
      <form className="mb-5 flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={search.q} aria-label="Search clients" placeholder="Name, industry, contact…" className="a-field !w-64 max-w-full" />
        <select name="status" defaultValue={search.status ?? ""} aria-label="Status" className="a-field !w-40">
          <option value="">All statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="manager" defaultValue={search.manager ?? ""} aria-label="Account manager" className="a-field !w-48">
          <option value="">Any account manager</option>
          <option value="none">No account manager</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button className="a-btn">Search</button>
        {filtered && (
          <Link href="/admin/clients" className="text-sm text-muted hover:text-brand-600">
            Clear
          </Link>
        )}
      </form>
      {rows.length ? (
        <div className="card relative overflow-x-auto">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Status</th>
                <th scope="col">Account manager</th>
                <th scope="col" className="text-right">
                  Open roles
                </th>
                <th scope="col" className="text-right">
                  Positions asked for
                </th>
                <th scope="col" className="text-right">
                  Submissions
                </th>
                <th scope="col" className="text-right">
                  Placed
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="min-w-56">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium hover:text-brand-600">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted">{[c.industry, c.location, c.primary_contact].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td>
                    <ClientStatusBadge status={c.status} />
                  </td>
                  <td>{c.account_manager_name ?? <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{c.open_openings}</td>
                  <td className="text-right tabular-nums">{c.open_positions}</td>
                  <td className="text-right tabular-nums">{c.submissions}</td>
                  <td className="text-right tabular-nums">{c.placements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={filtered ? "No clients match" : "No clients yet"} icon={Building2}>
          {filtered
            ? "Try a different search."
            : "Add a client, create one from a website enquiry, or type a client name on a job opening. Every opening's client is listed here."}
        </EmptyState>
      )}
    </>
  );
}
