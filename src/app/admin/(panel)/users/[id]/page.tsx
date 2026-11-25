import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getAdmin } from "@/lib/data/users";
import { PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { ResetPasswordForm, UserForm } from "./UserForms";

export const metadata: Metadata = { title: "Edit user" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("users.manage");
  const { id } = await params;
  const u = /^[0-9a-f-]{36}$/i.test(id) ? await getAdmin(id) : null;
  if (!u) notFound();
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
        <Panel title="Password">
          <p className="mb-3 text-sm text-muted">Creates a new temporary password, signs them out everywhere and unlocks the account.</p>
          <ResetPasswordForm id={u.id} />
        </Panel>
      </div>
    </div>
  );
}
