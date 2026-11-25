import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getOpening } from "@/lib/data/openings";
import { ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { Notice, OpeningStatusBadge, PageHeader, formatDateTime } from "@/components/admin/ui";
import { deleteOpeningAction, duplicateOpeningAction, setOpeningStatusAction } from "../../../actions/openings";
import { OpeningForm } from "../OpeningForm";

export const metadata: Metadata = { title: "Edit opening" };

export default async function OpeningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; incomplete?: string }> }) {
  const me = await requireAdmin("openings.view");
  const { id } = await params;
  const sp = await searchParams;
  const o = await getOpening(id);
  if (!o) notFound();
  const editable = can(me.role, "openings.edit");
  const showClient = can(me.role, "openings.viewClient");

  const statusButton = (status: string, label: string) => (
    <form action={setOpeningStatusAction}>
      <input type="hidden" name="id" value={o.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={status === "published" ? "a-btn a-btn-primary" : "a-btn"} pendingLabel="…">
        {label}
      </SubmitButton>
    </form>
  );

  return (
    <div className="max-w-3xl">
      <Link href="/admin/openings" className="text-sm text-muted hover:text-brand-600">
        ← Job Openings
      </Link>
      {sp.created && <Notice tone="green">Opening created{o.status === "published" ? " and published on the Careers page" : " as a draft"}.</Notice>}
      {sp.incomplete && <Notice tone="amber">Complete the required fields (including a description) before publishing.</Notice>}
      <PageHeader
        title={o.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OpeningStatusBadge status={o.status} /> Created {formatDateTime(o.created_at)}
            {o.published_at && <> · first published {formatDateTime(o.published_at)}</>}
          </span>
        }
        actions={
          <>
            <Link href={`/admin/applications?opening=${o.id}`} className="a-btn">
              Applications
            </Link>
            {o.status === "published" && (
              <a href={`/careers/${o.slug}`} target="_blank" rel="noreferrer" className="a-btn">
                View on website
              </a>
            )}
          </>
        }
      />

      {editable && (
        <div className="card mb-5 flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-sm font-medium">Quick actions</span>
          {o.status !== "published" && statusButton("published", "Publish")}
          {o.status === "published" && statusButton("paused", "Pause")}
          {o.status !== "closed" && statusButton("closed", "Close")}
          {o.status !== "draft" && o.status !== "published" && statusButton("draft", "Back to draft")}
          <form action={duplicateOpeningAction}>
            <input type="hidden" name="id" value={o.id} />
            <SubmitButton className="a-btn" pendingLabel="…">
              Duplicate
            </SubmitButton>
          </form>
          {can(me.role, "openings.delete") && (
            <div className="ml-auto">
              <ConfirmButton action={deleteOpeningAction} hidden={{ id: o.id }} confirm={`Delete "${o.title}"? Applications already received are kept.`}>
                Delete
              </ConfirmButton>
            </div>
          )}
        </div>
      )}

      {editable ? (
        <OpeningForm
          values={{
            id: o.id,
            title: o.title,
            sap_module: o.sap_module,
            client_name: o.client_name,
            public_client_label: o.public_client_label,
            location: o.location,
            work_mode: o.work_mode,
            experience: o.experience,
            employment_type: o.employment_type,
            salary_range: o.salary_range,
            summary: o.summary,
            description: o.description,
            skills: o.skills.join(", "),
            status: o.status,
            closing_date: o.closing_date ?? "",
          }}
        />
      ) : (
        <div className="card grid gap-3 p-5 text-sm">
          {showClient && <p><span className="text-muted">Client:</span> {o.client_name || "—"}</p>}
          <p><span className="text-muted">Shown as:</span> {o.public_client_label}</p>
          <p><span className="text-muted">Location:</span> {o.location} · {o.work_mode}</p>
          <p><span className="text-muted">Type:</span> {o.employment_type} · {o.experience}</p>
          <p className="whitespace-pre-line">{o.description}</p>
        </div>
      )}
    </div>
  );
}
