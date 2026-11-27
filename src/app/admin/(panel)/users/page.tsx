import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { listAdmins } from "@/lib/data/users";
import { Badge, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Users" };

const ROLE_HELP: Record<string, string> = {
  super_admin: "Everything, including users, settings and deleting records.",
  recruiter: "Openings (incl. client names), applications, resumes, CSV export. Can view enquiries.",
  sales: "Enquiries (update), and view openings and applications. Can download resumes.",
  viewer: "Read-only: dashboard, openings, applications and enquiries. No resumes.",
};

export default async function UsersPage() {
  const me = await requireAdmin("users.manage");
  const users = await listAdmins();
  const now = new Date();
  return (
    <>
      <PageHeader title="Users" description="People who can sign in to the admin panel, and what each can do." />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-x-auto">
          <table className="a-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-brand-600">
                      {u.name}
                    </Link>
                    {u.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="whitespace-nowrap">{ROLE_LABELS[u.role]}</td>
                  <td className="whitespace-nowrap">
                    {!u.active ? (
                      <Badge tone="grey">Deactivated</Badge>
                    ) : u.locked_until && new Date(u.locked_until) > now ? (
                      <Badge tone="red">Locked</Badge>
                    ) : u.must_change_password ? (
                      <Badge tone="amber">Invited</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid content-start gap-6">
          <Panel title="Add a user">
            <InviteForm />
          </Panel>
          <Panel title="Roles">
            <dl className="grid gap-3 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
                  <dd className="text-muted">{ROLE_HELP[r]}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
