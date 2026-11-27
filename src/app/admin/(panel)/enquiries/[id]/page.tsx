import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getEnquiry } from "@/lib/data/enquiries";
import { clientForEnquiry } from "@/lib/data/clients";
import { ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { EnquiryStatusBadge, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { deleteEnquiryAction } from "../../../actions/enquiries";
import { clientFromEnquiryAction } from "../../../actions/clients";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("enquiries.view");
  const e = await getEnquiry((await params).id);
  if (!e) notFound();
  const editable = can(me.role, "enquiries.update");
  const seeClients = can(me.role, "clients.view");
  const client = seeClients ? await clientForEnquiry(e.id) : null;
  const facts: [string, string][] = [
    ["Company", e.company],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Service", e.service],
    ["Requirement", e.requirement],
  ];
  return (
    <>
      <Link href="/admin/enquiries" className="text-sm text-muted hover:text-brand-600">
        ← Enquiries
      </Link>
      <PageHeader
        title={e.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <EnquiryStatusBadge status={e.status} /> Enquiry #{e.number} · received {formatDateTime(e.created_at)}
          </span>
        }
        actions={
          <>
            <a href={`mailto:${e.email}`} className="a-btn">
              <Mail aria-hidden className="size-4" /> Reply by email
            </a>
            {e.phone && (
              <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className="a-btn">
                <Phone aria-hidden className="size-4" /> Call
              </a>
            )}
            {client ? (
              <Link href={`/admin/clients/${client.id}`} className="a-btn">
                <Building2 aria-hidden className="size-4" /> Client: {client.name}
              </Link>
            ) : (
              can(me.role, "clients.edit") && (
                <form action={clientFromEnquiryAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <SubmitButton className="a-btn" pendingLabel="Creating…">
                    <Building2 aria-hidden className="size-4" /> Create client
                  </SubmitButton>
                </form>
              )
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Enquiry">
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5 break-words font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm text-muted">Message</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{e.message}</p>
          </div>
        </Panel>
        <div className="grid content-start gap-6">
          <Panel title="Follow-up">
            {editable ? (
              <EnquiryForm id={e.id} status={e.status} notes={e.notes} />
            ) : (
              <p className="whitespace-pre-line text-sm">{e.notes || <span className="text-muted">No notes yet.</span>}</p>
            )}
          </Panel>
          {editable && (
            <Panel title="Delete">
              <ConfirmButton action={deleteEnquiryAction} hidden={{ id: e.id }} confirm={`Delete enquiry #${e.number} from ${e.name}?`}>
                Delete enquiry
              </ConfirmButton>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
