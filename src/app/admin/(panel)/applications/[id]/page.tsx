import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getApplication } from "@/lib/data/applications";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { ApplicationStatusBadge, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { deleteApplicationAction, setApplicationStatusAction } from "../../../actions/applications";
import { NoteForm } from "./NoteForm";

export const metadata: Metadata = { title: "Application" };

const DETAIL_LABELS: Record<string, string> = { employmentType: "Employment type", preferredLocation: "Preferred location", consentVersion: "Consent (policy version)", consentAt: "Consent given", reference: "Upload reference" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("applications.view");
  const a = await getApplication((await params).id);
  if (!a) notFound();
  const showClient = can(me.role, "openings.viewClient");
  const editable = can(me.role, "applications.update");
  const isPdf = a.resume_path?.endsWith(".pdf");

  const facts: [string, React.ReactNode][] = [
    ["Position", a.position],
    ["Job opening", a.opening_id ? <Link href={`/admin/openings/${a.opening_id}`} className="text-brand-600 hover:underline">{a.opening_title}</Link> : "—"],
    ...(a.opening_id ? ([[showClient ? "Client" : "Employer (public)", showClient ? a.client_name || "—" : a.public_client_label]] as [string, React.ReactNode][]) : []),
    ["Source", APPLICATION_SOURCE_LABELS[a.source]],
    ["Experience", a.experience || a.candidate_experience || "—"],
    ["Specialisation", a.specialisation || "—"],
    ["Location", a.location || "—"],
    ...Object.entries(a.details ?? {})
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => [DETAIL_LABELS[k] ?? k, k === "consentAt" ? formatDateTime(String(v)) : String(v)] as [string, React.ReactNode]),
  ];

  return (
    <>
      <Link href="/admin/applications" className="text-sm text-muted hover:text-brand-600">
        ← Applications
      </Link>
      <PageHeader
        title={a.full_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ApplicationStatusBadge status={a.status} /> Application #{a.number} · received {formatDateTime(a.submitted_at)}
          </span>
        }
        actions={
          <>
            <a href={`mailto:${a.email}`} className="a-btn">
              <Mail aria-hidden className="size-4" /> Email
            </a>
            {a.phone && (
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="a-btn">
                <Phone aria-hidden className="size-4" /> Call
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Candidate">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="mt-0.5 break-all font-medium">{a.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Phone</dt>
                <dd className="mt-0.5 font-medium">{a.phone || "—"}</dd>
              </div>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {a.message && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm text-muted">Message</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{a.message}</p>
              </div>
            )}
          </Panel>

          <Panel title="Resume">
            {a.resume_path ? (
              can(me.role, "resumes.download") ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 truncate text-sm">{a.resume_name || "Resume"}</span>
                  {a.resume_size ? <span className="text-xs text-muted">{Math.max(1, Math.round(a.resume_size / 1024))} KB</span> : null}
                  <span className="ml-auto flex gap-2">
                    {isPdf && (
                      <a href={`/admin/api/resume/${a.id}?view=1`} target="_blank" rel="noreferrer" className="a-btn">
                        <Eye aria-hidden className="size-4" /> View
                      </a>
                    )}
                    <a href={`/admin/api/resume/${a.id}`} className="a-btn a-btn-primary">
                      <Download aria-hidden className="size-4" /> Download
                    </a>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted">A resume is on file. Your role can&apos;t download resumes.</p>
              )
            ) : (
              <p className="text-sm text-muted">No resume stored with this application{a.source !== "cv_upload" ? " (it was sent by email)" : ""}.</p>
            )}
          </Panel>

          <Panel title="Notes and history">
            {editable && <NoteForm id={a.id} />}
            {a.events.length ? (
              <ol className="mt-4 grid gap-3">
                {a.events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="text-xs text-muted">
                      {e.user_name ?? "Someone"} · {formatDateTime(e.created_at)}
                    </p>
                    {e.kind === "note" ? (
                      <p className="mt-1 whitespace-pre-line">{e.body}</p>
                    ) : (
                      <p className="mt-1">
                        Status changed from <strong>{APPLICATION_STATUS_LABELS[e.from_status as keyof typeof APPLICATION_STATUS_LABELS] ?? e.from_status}</strong> to{" "}
                        <strong>{APPLICATION_STATUS_LABELS[e.to_status as keyof typeof APPLICATION_STATUS_LABELS] ?? e.to_status}</strong>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">No notes or status changes yet.</p>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          {editable && (
            <Panel title="Status">
              <div className="flex flex-wrap gap-2">
                {APPLICATION_STATUSES.map((s) => (
                  <form key={s} action={setApplicationStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton className={`a-chip ${a.status === s ? "!border-btn !bg-btn !text-white" : ""}`} pendingLabel="…">
                      {APPLICATION_STATUS_LABELS[s]}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </Panel>
          )}

          <Panel title={`Other applications from ${a.full_name.split(" ")[0]}`} bodyClass="">
            {a.others.length ? (
              <ul className="divide-y divide-line">
                {a.others.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/admin/applications/${o.id}`} className="min-w-0 hover:text-brand-600">
                      <span className="block truncate font-medium">{o.position}</span>
                      <span className="text-xs text-muted">
                        #{o.number} · {formatDateTime(o.submitted_at)}
                      </span>
                    </Link>
                    <ApplicationStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">This is their only application.</p>
            )}
          </Panel>

          {can(me.role, "applications.delete") && (
            <Panel title="Delete">
              <p className="mb-3 text-sm text-muted">Removes this application, its notes and its stored resume. Use this for data-deletion requests.</p>
              <ConfirmButton action={deleteApplicationAction} hidden={{ id: a.id }} confirm={`Delete application #${a.number} from ${a.full_name}? This can't be undone.`}>
                Delete application
              </ConfirmButton>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
