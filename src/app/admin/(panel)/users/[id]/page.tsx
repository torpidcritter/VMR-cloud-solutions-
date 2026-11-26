import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getAdmin } from "@/lib/data/users";
import { getTarget, currentMonth } from "@/lib/data/workspace";
import { Badge, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { can } from "@/lib/auth/permissions";
import { LOGIN_OUTCOME_LABELS, listLogins } from "@/lib/data/audit";
import { ResetPasswordForm, TargetForm, UserForm } from "./UserForms";

export const metadata: Metadata = { title: "Edit user" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("users.manage");
  const { id } = await params;
  const u = /^[0-9a-f-]{36}$/i.test(id) ? await getAdmin(id) : null;
  if (!u) notFound();
  const showTarget = u.role === "recruiter" || u.role === "super_admin";
  const target = showTarget ? await getTarget(u.id) : null;
  const audit = can(me.role, "activity.view");
  const logins = audit ? (await listLogins({ user: u.id }, { limit: 8 })).rows : [];
  const monthName = new Date(`${currentMonth()}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="max-w-3xl">
      <Link href="/admin/users" className="text-sm text-muted hover:text-brand-600">
        ← Users
      </Link>
      <PageHeader title={u.name} description={`${u.email} · added ${formatDateTime(u.created_at)} · last sign-in ${u.last_login_at ? formatDateTime(u.last_login_at) : "never"}`} />
      <div className="grid gap-6">
        <Panel title="Details and role">
          <UserForm user={{ id: u.id, name: u.name, role: u.role, active: u.active }} self={u.id === me.id} />
        </Panel>
        {showTarget && (
          <Panel title={`Placement target for ${monthName}`}>
            <p className="mb-3 text-sm text-muted">Shown on their My work page against hires assigned to them this month. Leave empty for no target.</p>
            <TargetForm userId={u.id} target={target} />
          </Panel>
        )}
        <Panel title="Password">
          <p className="mb-3 text-sm text-muted">Creates a new temporary password, signs them out everywhere and unlocks the account.</p>
          <ResetPasswordForm id={u.id} />
        </Panel>
        {audit && (
          <Panel
            title="Recent sign-ins"
            bodyClass=""
            actions={
              <Link href={`/admin/activity?user=${u.id}`} className="text-sm text-brand-600 hover:underline">
                Their activity
              </Link>
            }
          >
            {logins.length ? (
              <ul className="divide-y divide-line text-sm">
                {logins.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                    <Badge tone={l.outcome === "success" ? "green" : l.outcome === "signout" ? "grey" : "red"}>{LOGIN_OUTCOME_LABELS[l.outcome]}</Badge>
                    <span className="text-muted">
                      {formatDateTime(l.created_at)}
                      {l.ip ? ` · ${l.ip}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No sign-ins recorded yet.</p>
            )}
            <p className="border-t border-line px-5 py-2.5 text-xs">
              <Link href={`/admin/activity?tab=signins&user=${u.id}`} className="text-brand-600 hover:underline">
                All sign-in records for {u.name}
              </Link>
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
