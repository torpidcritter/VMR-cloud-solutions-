import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { managerOptions } from "@/lib/data/clients";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ClientForm } from "@/components/admin/crm-ui";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const me = await requireAdmin("clients.edit");
  const managers = await managerOptions();
  return (
    <div className="max-w-2xl">
      <Link href="/admin/clients" className="text-sm text-muted hover:text-brand-600">
        ← Clients
      </Link>
      <PageHeader title="New client" description="Contacts and requirements can be added once the client is saved." />
      <Panel>
        <ClientForm
          values={{ name: "", industry: "", website: "", location: "", status: "active", account_manager_id: managers.some((m) => m.id === me.id) ? me.id : "", notes: "" }}
          managers={managers}
        />
      </Panel>
    </div>
  );
}
