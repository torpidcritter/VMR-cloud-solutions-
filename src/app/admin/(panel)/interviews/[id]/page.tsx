import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ExternalLink, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getInterview, interviewerOptions, isoToIst } from "@/lib/data/interviews";
import { INTERVIEW_MODE_LABELS, RECOMMENDATION_LABELS } from "@/lib/data/constants";
import { SubmitButton } from "@/components/admin/forms";
import { InterviewForm } from "@/components/admin/InterviewForm";
import { ApplicationStatusBadge, Badge, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { InterviewStatusBadge, ist } from "@/components/admin/interview-ui";
import { interviewStatusAction } from "../../../actions/interviews";
import { FeedbackForm } from "./FeedbackForm";
import { maskEmail, maskPhone } from "@/lib/mask";

export const metadata: Metadata = { title: "Interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("applications.view");
  const i = await getInterview((await params).id);
  if (!i) notFound();
  const manage = can(me.role, "interviews.manage");
  const onPanel = i.panel.some((p) => p.id === me.id);
  const mine = i.feedback.find((f) => f.user_id === me.id);
  const canFeedback = (onPanel || manage) && i.status !== "cancelled";
  const scheduled = i.status === "scheduled";
  const started = new Date(i.scheduled_at).getTime() <= Date.now();
  const interviewers = manage && scheduled ? await interviewerOptions() : [];
  const local = isoToIst(i.scheduled_at);
  const avg = i.feedback.length ? i.feedback.reduce((n, f) => n + f.rating, 0) / i.feedback.length : null;
  const isLink = /^https:\/\//i.test(i.location);

  const statusButton = (status: string, label: string, primary = false) => (
    <form action={interviewStatusAction}>
      <input type="hidden" name="id" value={i.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={primary ? "a-btn a-btn-primary" : "a-btn"} pendingLabel="…">
        {label}
      </SubmitButton>
    </form>
  );

  return (
    <>
      <Link href="/admin/interviews" className="text-sm text-muted hover:text-brand-600">
        ← Interviews
      </Link>
      <PageHeader
        title={`${i.round}: ${i.candidate_name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <InterviewStatusBadge status={i.status} />
            {ist(i.scheduled_at, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })} IST · {i.duration_minutes} minutes
          </span>
        }
        actions={
          <>
            <a href={`/admin/api/interviews/${i.id}/ics`} className="a-btn">
              <CalendarPlus aria-hidden className="size-4" /> Add to calendar
            </a>
            {isLink && scheduled && (
              <a href={i.location} target="_blank" rel="noreferrer noopener" className="a-btn a-btn-primary">
                <ExternalLink aria-hidden className="size-4" /> Join
              </a>
            )}
          </>
        }
      />

      {manage && scheduled && (
        <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-sm font-medium">Outcome</span>
          {statusButton("completed", "Mark completed", started)}
          {statusButton("no_show", "Candidate didn't attend")}
          <form action={interviewStatusAction} className="ml-auto flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="status" value="cancelled" />
            <label htmlFor="reason" className="sr-only">
              Reason for cancelling
            </label>
            <input id="reason" name="reason" maxLength={300} placeholder="Reason (optional)" className="a-field !w-48 !py-1.5 text-sm" />
            <SubmitButton className="a-btn a-btn-danger" pendingLabel="…">
              Cancel interview
            </SubmitButton>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Details">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Candidate</dt>
                <dd className="mt-0.5 font-medium">
                  <Link href={`/admin/candidates/${i.candidate_id}`} className="hover:text-brand-600">
                    {i.candidate_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Application</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium">
                  <Link href={`/admin/applications/${i.application_id}`} className="hover:text-brand-600">
                    #{i.application_number} {i.opening_title ?? i.position}
                  </Link>
                  <ApplicationStatusBadge status={i.application_status} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">How</dt>
                <dd className="mt-0.5 font-medium">{INTERVIEW_MODE_LABELS[i.mode]}</dd>
              </div>
              <div>
                <dt className="text-muted">{i.mode === "video" ? "Meeting link" : i.mode === "phone" ? "Phone" : "Address"}</dt>
                <dd className="mt-0.5 break-all font-medium">{i.location || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Panel</dt>
                <dd className="mt-0.5 font-medium">{i.panel.map((p) => p.name).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Candidate contact</dt>
                <dd className="mt-0.5 break-all font-medium">
                  {can(me.role, "candidates.contact") ? i.candidate_email : maskEmail(i.candidate_email)}
                  {i.candidate_phone ? ` · ${can(me.role, "candidates.contact") ? i.candidate_phone : maskPhone(i.candidate_phone)}` : ""}
                </dd>
              </div>
              {i.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Notes for the panel</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{i.notes}</dd>
                </div>
              )}
              {i.cancel_reason && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Reason</dt>
                  <dd className="mt-0.5">{i.cancel_reason}</dd>
                </div>
              )}
            </dl>
            <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
              Scheduled by {i.created_by_name ?? "someone"} on {formatDateTime(i.created_at)}
            </p>
          </Panel>

          {manage && scheduled && (
            <Panel title="Reschedule or change details">
              <InterviewForm
                idPrefix="rs"
                interviewers={interviewers}
                values={{
                  interviewId: i.id,
                  round: i.round,
                  date: local.date,
                  time: local.time,
                  duration: String(i.duration_minutes),
                  mode: i.mode,
                  location: i.location,
                  notes: i.notes,
                  panel: i.panel.map((p) => p.id),
                }}
              />
            </Panel>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title="Feedback"
            actions={
              avg !== null && (
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Star aria-hidden className="size-4 fill-amber-400 text-amber-400" /> {avg.toFixed(1)} / 5
                </span>
              )
            }
          >
            {i.feedback.length ? (
              <ul className="mb-5 grid gap-3">
                {i.feedback.map((f) => (
                  <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.user_name ?? "Former user"}</span>
                      <Badge tone={f.recommendation === "no" ? "red" : f.recommendation === "maybe" ? "amber" : "green"}>{RECOMMENDATION_LABELS[f.recommendation]}</Badge>
                      <span className="ml-auto tabular-nums text-muted">{f.rating} / 5</span>
                    </p>
                    {f.notes && <p className="mt-1.5 whitespace-pre-line">{f.notes}</p>}
                    <p className="mt-1.5 text-xs text-muted">{formatDateTime(f.updated_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted">No feedback yet.</p>
            )}
            {canFeedback ? (
              <>
                <h3 className="mb-3 text-sm font-semibold">{mine ? "Your feedback" : "Add your feedback"}</h3>
                <FeedbackForm id={i.id} values={mine ? { rating: mine.rating, recommendation: mine.recommendation, notes: mine.notes } : undefined} />
                {scheduled && <p className="mt-3 text-xs text-muted">Saving feedback marks the interview as completed.</p>}
              </>
            ) : (
              i.status !== "cancelled" && <p className="text-sm text-muted">Only the interview panel can leave feedback.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
