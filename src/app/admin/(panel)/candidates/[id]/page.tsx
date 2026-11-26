import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, Eye, Mail, Pencil, Phone, Trash2, Users, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getCandidate } from "@/lib/data/candidates";
import { recruiterOptions } from "@/lib/data/applications";
import { listInterviews } from "@/lib/data/interviews";
import { listCandidateFiles, listPools, poolsForCandidate } from "@/lib/data/talent";
import { matchOpeningsForCandidate } from "@/lib/data/matching";
import { AddToPoolForm, MatchReasons, PutForwardButton, ScoreRing, UploadResumeForm } from "@/components/admin/talent-ui";
import { InterviewList } from "@/components/admin/interview-ui";
import { APPLICATION_SOURCE_LABELS, CANDIDATE_PRIORITIES, CANDIDATE_PRIORITY_LABELS } from "@/lib/data/constants";
import { ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { ApplicationStatusBadge, Badge, Notice, PageHeader, Panel, formatDate, formatDateTime } from "@/components/admin/ui";
import { EVENT_KIND_LABELS, EventText, PriorityBadge, TagList, eventTone } from "@/components/admin/candidate-ui";
import { mergeCandidatesAction, quickCandidateAction } from "../../../actions/candidates";
import { deleteCandidateFileAction, removeFromPoolAction } from "../../../actions/talent";
import { CandidateNoteForm } from "./CandidateNoteForm";
import { ProfileForm } from "./ProfileForm";
import { QuickField } from "./QuickField";

export const metadata: Metadata = { title: "Candidate" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 40) : undefined);
const KINDS = ["note", "status", "interview", "assign", "edit", "file", "pool", "merge"] as const;

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin("applications.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCandidate(id);
  if (!c) notFound();
  const editable = can(me.role, "candidates.edit");
  const canMerge = can(me.role, "candidates.merge");
  const canDownload = can(me.role, "resumes.download");
  const editing = editable && one(sp.edit) === "1";
  const kind = (KINDS as readonly string[]).includes(one(sp.kind) ?? "") ? one(sp.kind) : undefined;
  const canPool = can(me.role, "talent.manage");
  const canForward = can(me.role, "applications.update");
  const [recruiters, interviews, files, pools, allPools, matches] = await Promise.all([
    editable ? recruiterOptions() : Promise.resolve([]),
    listInterviews({ candidateId: c.id }, 50),
    listCandidateFiles(c.id),
    poolsForCandidate(c.id),
    canPool ? listPools() : Promise.resolve([]),
    matchOpeningsForCandidate(c.id, 5),
  ]);
  const freePools = allPools.filter((p) => !pools.some((x) => x.id === p.id));
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const followDue = !!c.follow_up_on && c.follow_up_on <= today;
  const timeline = kind ? c.timeline.filter((e) => e.kind === kind) : c.timeline;
  const resumes = c.applications.filter((a) => a.has_resume);
  const base = `/admin/candidates/${c.id}`;

  const facts: [string, React.ReactNode][] = [
    ["Email", <span key="e" className="break-all">{c.email}</span>],
    ["Phone", c.phone || "—"],
    ["Current role", [c.current_title, c.current_company].filter(Boolean).join(" at ") || "—"],
    ["Experience", c.experience_years != null ? `${c.experience_years} years` : c.experience || "—"],
    ["Specialisation", c.specialisation || "—"],
    ["Location", c.location || "—"],
    ["Preferred location", c.preferred_location || "—"],
    ["Notice period", c.notice_period || "—"],
    ["Availability", c.availability || "—"],
    ["Employment type", c.employment_type || "—"],
  ];

  return (
    <>
      <Link href="/admin/candidates" className="text-sm text-muted hover:text-brand-600">
        ← Candidates
      </Link>
      <PageHeader
        title={c.full_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <PriorityBadge priority={c.priority} />
            {c.current_title && <span>{c.current_title}</span>}
            <span>
              · {c.applications.length} application{c.applications.length === 1 ? "" : "s"} · profile since {formatDate(c.created_at)}
            </span>
          </span>
        }
        actions={
          <>
            <a href={`mailto:${c.email}`} className="a-btn">
              <Mail aria-hidden className="size-4" /> Email
            </a>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="a-btn">
                <Phone aria-hidden className="size-4" /> Call
              </a>
            )}
            {c.linkedin_url && (
              <a href={c.linkedin_url} target="_blank" rel="noreferrer noopener" className="a-btn">
                <ExternalLink aria-hidden className="size-4" /> LinkedIn
              </a>
            )}
            {editable && (
              <form action={quickCandidateAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="field" value="contacted" />
                <SubmitButton className="a-btn" pendingLabel="Saving…">
                  <CheckCircle2 aria-hidden className="size-4" /> Mark contacted
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {one(sp.created) === "1" && <Notice tone="green">Added to the Talent Bank.</Notice>}
      {one(sp.resume) === "failed" && <Notice tone="red">The profile was added, but the resume couldn&apos;t be stored. Try uploading it again below.</Notice>}
      {one(sp.merged) === "1" && <Notice tone="green">The duplicate profile was merged into this one. Its applications and history are listed below.</Notice>}

      {/* Ownership and follow-up, always in view */}
      <section aria-label="Ownership and follow-up" className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {editable ? (
          <>
            <QuickField id={c.id} field="priority" label="Priority" value={c.priority} options={CANDIDATE_PRIORITIES.map((p) => ({ value: p, label: CANDIDATE_PRIORITY_LABELS[p] }))} />
            <QuickField id={c.id} field="owner" label="Owner" value={c.owner_id ?? ""} options={[{ value: "", label: "No owner" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]} />
            <QuickField id={c.id} field="followup" label="Follow up on" value={c.follow_up_on ?? ""} type="date" />
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted">Priority</p>
              <p className="mt-1 text-sm font-medium">{CANDIDATE_PRIORITY_LABELS[c.priority]}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Owner</p>
              <p className="mt-1 text-sm font-medium">{c.owner_name ?? "No owner"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Follow up on</p>
              <p className="mt-1 text-sm font-medium">{c.follow_up_on ? formatDate(c.follow_up_on) : "—"}</p>
            </div>
          </>
        )}
        <div>
          <p className="text-xs text-muted">Last contacted</p>
          <p className="mt-1 text-sm font-medium">{c.last_contacted_at ? formatDateTime(c.last_contacted_at) : "Not recorded"}</p>
          {followDue && <p className="mt-1 text-xs font-medium text-accent-600">Follow-up is due</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title="Profile"
            actions={
              editable &&
              (editing ? (
                <Link href={base} className="a-btn">
                  Done
                </Link>
              ) : (
                <Link href={`${base}?edit=1`} className="a-btn">
                  <Pencil aria-hidden className="size-4" /> Edit profile
                </Link>
              ))
            }
          >
            {editing ? (
              <ProfileForm
                values={{
                  id: c.id,
                  full_name: c.full_name,
                  phone: c.phone,
                  location: c.location,
                  preferred_location: c.preferred_location,
                  specialisation: c.specialisation,
                  current_title: c.current_title,
                  current_company: c.current_company,
                  experience_years: c.experience_years != null ? String(c.experience_years) : "",
                  notice_period: c.notice_period,
                  availability: c.availability,
                  qualifications: c.qualifications,
                  skills: c.skills.join(", "),
                  tags: c.tags.join(", "),
                  linkedin_url: c.linkedin_url,
                  summary: c.summary,
                }}
              />
            ) : (
              <>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  {facts.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted">{k}</dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-muted">Skills</dt>
                    <dd className="mt-1">
                      <TagList items={c.skills} />
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted">Tags</dt>
                    <dd className="mt-1">
                      <TagList items={c.tags} tone="grey" />
                    </dd>
                  </div>
                </dl>
                {(c.qualifications || c.summary) && (
                  <div className="mt-5 grid gap-4 border-t border-line pt-4 text-sm">
                    {c.qualifications && (
                      <div>
                        <p className="text-muted">Qualifications and certifications</p>
                        <p className="mt-1 whitespace-pre-line">{c.qualifications}</p>
                      </div>
                    )}
                    {c.summary && (
                      <div>
                        <p className="text-muted">Recruiter summary</p>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{c.summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel title="Applications" bodyClass="">
            {c.applications.length ? (
              <div className="overflow-x-auto">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Stage</th>
                      <th scope="col">Recruiter</th>
                      <th scope="col">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.applications.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/admin/applications/${a.id}`} className="font-medium hover:text-brand-600">
                            {a.opening_title ?? a.position}
                          </Link>
                          <span className="block text-xs text-muted">
                            #{a.number} · {APPLICATION_SOURCE_LABELS[a.source as keyof typeof APPLICATION_SOURCE_LABELS] ?? a.source}
                          </span>
                        </td>
                        <td>
                          <ApplicationStatusBadge status={a.status} />
                          <span className="mt-1 block text-xs text-muted">since {formatDate(a.stage_changed_at)}</span>
                        </td>
                        <td>{a.assigned_name ?? <span className="text-muted">Unassigned</span>}</td>
                        <td className="whitespace-nowrap">{formatDate(a.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No applications on this profile.</p>
            )}
          </Panel>

          <Panel title={`Interviews${interviews.length ? ` (${interviews.length})` : ""}`} bodyClass="">
            <InterviewList items={[...interviews].reverse()} empty="No interviews yet. Schedule one from an application." showCandidate={false} />
          </Panel>

          <Panel title="Timeline">
            {editable && (
              <div className="mb-5">
                <CandidateNoteForm id={c.id} applications={c.applications.map((a) => ({ id: a.id, label: `#${a.number} ${a.opening_title ?? a.position}`.slice(0, 80) }))} />
              </div>
            )}
            <nav aria-label="Filter timeline" className="mb-4 flex flex-wrap gap-2">
              <Link href={base} className={`a-chip ${!kind ? "!border-btn !bg-btn !text-white" : ""}`} aria-current={!kind ? "true" : undefined}>
                Everything
              </Link>
              {KINDS.map((k) => (
                <Link key={k} href={`${base}?kind=${k}`} className={`a-chip ${kind === k ? "!border-btn !bg-btn !text-white" : ""}`} aria-current={kind === k ? "true" : undefined}>
                  {EVENT_KIND_LABELS[k]}
                </Link>
              ))}
            </nav>
            {timeline.length ? (
              <ol className="grid gap-3">
                {timeline.map((e) => (
                  <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <Badge tone={eventTone(e.kind)}>{EVENT_KIND_LABELS[e.kind] ?? e.kind}</Badge>
                      <span>
                        {e.user_name ?? "System"} · {formatDateTime(e.created_at)}
                      </span>
                      {e.application_id && (
                        <Link href={`/admin/applications/${e.application_id}`} className="hover:text-brand-600">
                          #{e.application_number} {e.application_position}
                        </Link>
                      )}
                    </p>
                    <EventText e={e} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{kind ? "Nothing of this kind yet." : "No history yet."}</p>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Resumes" bodyClass="">
            {resumes.length || files.length ? (
              canDownload ? (
                <ul className="divide-y divide-line">
                  {files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.file_name}</span>
                        <span className="text-xs text-muted">
                          Uploaded {formatDate(f.created_at)}
                          {f.uploaded_by_name ? ` by ${f.uploaded_by_name}` : ""} · {f.text_status === "ok" ? "searchable" : "no text found"}
                        </span>
                      </span>
                      {f.file_type === "pdf" && (
                        <a href={`/admin/api/candidate-files/${f.id}?view=1`} target="_blank" rel="noreferrer" className="a-btn" aria-label={`View ${f.file_name}`}>
                          <Eye aria-hidden className="size-4" />
                        </a>
                      )}
                      <a href={`/admin/api/candidate-files/${f.id}`} className="a-btn" aria-label={`Download ${f.file_name}`}>
                        <Download aria-hidden className="size-4" />
                      </a>
                      {editable && (
                        <ConfirmButton
                          action={deleteCandidateFileAction}
                          hidden={{ id: f.id }}
                          className="a-btn"
                          title="Delete this resume?"
                          confirmLabel="Delete resume"
                          confirm={`${f.file_name} will be removed from storage and from resume search. This can't be undone.`}
                        >
                          <Trash2 aria-hidden className="size-4" />
                          <span className="sr-only">Delete {f.file_name}</span>
                        </ConfirmButton>
                      )}
                    </li>
                  ))}
                  {resumes.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.opening_title ?? a.position}</span>
                        <span className="text-xs text-muted">Sent with application #{a.number} · {formatDate(a.submitted_at)}</span>
                      </span>
                      <a href={`/admin/api/resume/${a.id}?view=1`} target="_blank" rel="noreferrer" className="a-btn" aria-label={`View resume from ${formatDate(a.submitted_at)}`}>
                        <Eye aria-hidden className="size-4" />
                      </a>
                      <a href={`/admin/api/resume/${a.id}`} className="a-btn" aria-label={`Download resume from ${formatDate(a.submitted_at)}`}>
                        <Download aria-hidden className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted">Resumes are on file. Your role can&apos;t download resumes.</p>
              )
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No resume stored for this candidate.</p>
            )}
            {editable && (
              <div className="border-t border-line px-5 py-4">
                <UploadResumeForm candidateId={c.id} />
              </div>
            )}
          </Panel>

          <Panel title="Matching openings" bodyClass="">
            {matches.length ? (
              <ul className="divide-y divide-line">
                {matches.map((m) => (
                  <li key={m.id} className="flex gap-3 px-5 py-3 text-sm">
                    <ScoreRing score={m.match.score} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/openings/${m.id}`} className="font-medium hover:text-brand-600">
                        {m.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {[m.location, m.status === "paused" ? "Paused" : ""].filter(Boolean).join(" · ")}
                      </span>
                      <MatchReasons match={m.match} />
                      <div className="mt-2">
                        {m.applied ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                            <CheckCircle2 aria-hidden className="size-3.5 text-emerald-600" /> Already in this pipeline
                          </span>
                        ) : (
                          canForward && <PutForwardButton candidateId={c.id} openingId={m.id} />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No open role matches this profile&apos;s skills yet. Adding skills or a resume helps.</p>
            )}
          </Panel>

          <Panel title="Talent pools" bodyClass="">
            {pools.length ? (
              <ul className="flex flex-wrap gap-2 px-5 py-4">
                {pools.map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-3 pr-1 text-sm">
                    <Link href={`/admin/talent-pools/${p.id}`} className="hover:text-brand-600">
                      {p.name}
                    </Link>
                    {canPool && (
                      <form action={removeFromPoolAction}>
                        <input type="hidden" name="poolId" value={p.id} />
                        <input type="hidden" name="candidateId" value={c.id} />
                        <button className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Remove from ${p.name}`}>
                          <X aria-hidden className="size-3.5" />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Not in any talent pool.</p>
            )}
            {canPool && (
              <div className="border-t border-line px-5 py-4">
                {freePools.length ? (
                  <AddToPoolForm candidateId={c.id} pools={freePools} />
                ) : (
                  <p className="text-sm text-muted">
                    {allPools.length ? "In every pool already. " : "No pools yet. "}
                    <Link href="/admin/talent-pools" className="font-medium text-brand-600 hover:underline">
                      Manage talent pools
                    </Link>
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Possible duplicates" bodyClass="">
            {c.duplicates.length ? (
              <ul className="divide-y divide-line">
                {c.duplicates.map((d) => (
                  <li key={d.id} className="grid gap-2 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admin/candidates/${d.id}`} className="font-medium hover:text-brand-600">
                        {d.full_name}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {d.email} · {d.reason} · {d.applications} application{d.applications === 1 ? "" : "s"}
                      </span>
                    </div>
                    {canMerge && (
                      <ConfirmButton
                        action={mergeCandidatesAction}
                        hidden={{ keep: c.id, drop: d.id }}
                        className="a-btn justify-self-start"
                        title="Merge these profiles?"
                        confirmLabel="Merge profiles"
                        confirm={`${d.full_name} (${d.email}) will be folded into this profile. Their applications, notes and history move here, empty fields are filled in from their profile, and their profile is removed. This can't be undone.`}
                      >
                        <Users aria-hidden className="size-4" /> Merge into this profile
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No other profile shares this phone number or name.</p>
            )}
            {c.duplicates.length > 0 && !canMerge && <p className="border-t border-line px-5 py-3 text-xs text-muted">A Super Admin can merge duplicate profiles.</p>}
          </Panel>

          <Panel title="Record">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Created</dt>
                <dd>{formatDateTime(c.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last updated</dt>
                <dd>{formatDateTime(c.updated_at)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
