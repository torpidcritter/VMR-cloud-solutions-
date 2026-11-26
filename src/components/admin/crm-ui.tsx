"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, type ActionState } from "./forms";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from "@/lib/data/constants";
import { MERGE_FIELDS, renderTemplate, unfilledFields, type MergeValues } from "@/lib/email-templates";
import { addContactAction, addRequirementAction, clientNoteAction, saveClientAction } from "@/app/admin/actions/clients";
import { saveTemplateAction, sendCandidateEmailAction } from "@/app/admin/actions/email";
import { newSubmissionId } from "@/lib/forms";

type Field = React.InputHTMLAttributes<HTMLInputElement>;

function Input({ id, name, label, error, hint, span, ...props }: Field & { id: string; name: string; label: React.ReactNode; error?: string; hint?: string; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      <input id={id} name={name} className="a-field" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
      <FieldError id={`${id}-error`} error={error} />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

const optional = <span className="font-normal text-muted">(optional)</span>;

/* ------------------------------------------------------------------ */
/* Clients                                                              */
/* ------------------------------------------------------------------ */

export type ClientFormValues = { id?: string; name: string; industry: string; website: string; location: string; status: string; account_manager_id: string; notes: string };

export function ClientForm({ values, managers }: { values: ClientFormValues; managers: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveClientAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            {values.id && <input type="hidden" name="id" value={values.id} />}
            <Input id="cl-name" name="name" label="Company name" defaultValue={values.name} maxLength={160} error={e.name} span />
            <Input id="cl-industry" name="industry" label={<>Industry {optional}</>} defaultValue={values.industry} maxLength={120} placeholder="e.g. Manufacturing" />
            <Input id="cl-location" name="location" label={<>Location {optional}</>} defaultValue={values.location} maxLength={160} placeholder="e.g. Pune" />
            <Input id="cl-website" name="website" label={<>Website {optional}</>} defaultValue={values.website} maxLength={200} placeholder="example.com" error={e.website} />
            <div>
              <label htmlFor="cl-status" className="a-label">
                Status
              </label>
              <select id="cl-status" name="status" defaultValue={values.status} className="a-field">
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cl-manager" className="a-label">
                Account manager
              </label>
              <select id="cl-manager" name="account_manager_id" defaultValue={values.account_manager_id} className="a-field">
                <option value="">No one yet</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cl-notes" className="a-label">
                Notes {optional}
              </label>
              <textarea id="cl-notes" name="notes" defaultValue={values.notes} rows={4} maxLength={8000} className="a-field" placeholder="Rates agreed, billing terms, how they like candidates presented…" />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton>{values.id ? "Save client" : "Add client"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}

export function ContactForm({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={addContactAction} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <Input id="ct-name" name="name" label="Name" maxLength={120} error={e.name} />
            <Input id="ct-title" name="title" label={<>Job title {optional}</>} maxLength={120} placeholder="e.g. HR Manager" />
            <Input id="ct-email" name="email" type="email" label={<>Email {optional}</>} maxLength={200} error={e.email} />
            <Input id="ct-phone" name="phone" type="tel" label={<>Phone {optional}</>} maxLength={30} error={e.phone} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="is_primary" className="size-4" /> Make this the primary contact
            </label>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton className="a-btn" pendingLabel="Adding…">
                Add contact
              </SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}

export function RequirementForm({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={addRequirementAction} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <Input id="rq-title" name="title" label="Role needed" maxLength={160} placeholder="e.g. SAP S/4HANA FICO Consultant" error={e.title} span />
            <Input id="rq-sap" name="sap_module" label={<>SAP module {optional}</>} maxLength={80} placeholder="e.g. FICO" />
            <Input id="rq-positions" name="positions" label="Positions" inputMode="numeric" maxLength={3} defaultValue="1" error={e.positions} />
            <Input id="rq-needed" name="needed_by" type="date" label={<>Needed by {optional}</>} error={e.needed_by} />
            <div className="sm:col-span-2">
              <label htmlFor="rq-notes" className="a-label">
                Details {optional}
              </label>
              <textarea id="rq-notes" name="notes" rows={2} maxLength={4000} className="a-field" placeholder="Budget, location, interview process…" />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton className="a-btn" pendingLabel="Adding…">
                Add requirement
              </SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}

export function ClientNoteForm({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={clientNoteAction} resetOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          <label htmlFor="cl-note" className="sr-only">
            Add a note
          </label>
          <textarea id="cl-note" name="body" rows={3} maxLength={4000} placeholder="Add a note (meeting summary, feedback, next steps…)" aria-invalid={!!state.errors?.body} className="a-field" />
          <FieldError error={state.errors?.body} />
          <div className="mt-2 flex justify-end">
            <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/* ------------------------------------------------------------------ */
/* Email                                                                */
/* ------------------------------------------------------------------ */

type ComposeTemplate = { id: string; name: string; subject: string; body: string };

/**
 * Write an email to a candidate, optionally from a template. Merge fields are
 * filled in here so the recruiter sees exactly what will be sent and can edit it.
 */
export function EmailComposer({
  candidateId,
  to,
  templates,
  applications,
  base,
}: {
  candidateId: string;
  to: string;
  templates: ComposeTemplate[];
  applications: { id: string; label: string; values: MergeValues }[];
  base: MergeValues;
}) {
  const [templateId, setTemplateId] = useState("");
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // One key per message: a double click or retry of the same message sends it once (M-18).
  // Made in the browser after the first render, so the server and browser HTML match.
  const [sendKey, setSendKey] = useState("");
  useEffect(() => setSendKey(newSubmissionId()), []);
  const values = useMemo(() => applications.find((a) => a.id === applicationId)?.values ?? base, [applications, applicationId, base]);

  const apply = (tid: string, v: MergeValues) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    setSubject(renderTemplate(t.subject, v));
    setBody(renderTemplate(t.body, v));
  };

  const send = useCallback(async (prev: ActionState, form: FormData) => {
    const res = await sendCandidateEmailAction(prev, form);
    if (res.ok) {
      setTemplateId("");
      setSubject("");
      setBody("");
      setSendKey(newSubmissionId());
    }
    return res;
  }, []);

  const missing = unfilledFields(`${subject}\n${body}`);
  const label = (k: string) => MERGE_FIELDS.find((f) => f.key === k)?.label.toLowerCase() ?? k;

  return (
    <ActionForm action={send} className="grid gap-3">
      {(state) => (
        <>
          <input type="hidden" name="candidateId" value={candidateId} />
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="sendKey" value={sendKey} />
          <p className="text-sm">
            <span className="text-muted">To:</span> <span className="break-all font-medium">{to}</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="em-template" className="a-label">
                Template
              </label>
              <select
                id="em-template"
                className="a-field"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  apply(e.target.value, values);
                }}
              >
                <option value="">Write from scratch</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {applications.length > 0 && (
              <div>
                <label htmlFor="em-app" className="a-label">
                  About
                </label>
                <select
                  id="em-app"
                  name="applicationId"
                  className="a-field"
                  value={applicationId}
                  onChange={(e) => {
                    setApplicationId(e.target.value);
                    const v = applications.find((a) => a.id === e.target.value)?.values ?? base;
                    if (templateId) apply(templateId, v);
                  }}
                >
                  <option value="">The candidate in general</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="em-subject" className="a-label">
              Subject
            </label>
            <input id="em-subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="a-field" aria-invalid={!!state.errors?.subject} />
            <FieldError error={state.errors?.subject} />
          </div>
          <div>
            <label htmlFor="em-body" className="a-label">
              Message
            </label>
            <textarea
              id="em-body"
              name="body"
              rows={10}
              maxLength={8000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="a-field"
              aria-invalid={!!state.errors?.body}
              aria-describedby="em-missing"
            />
            <FieldError error={state.errors?.body} />
            {missing.length > 0 && !state.errors?.body && (
              <p id="em-missing" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Still to fill in: {missing.map(label).join(", ")}. Replace the {"{{…}}"} text, or pick an application with an interview booked.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Replies come to your own email address. The email is saved on this profile.</p>
            <SubmitButton pendingLabel="Sending…">
              <Send aria-hidden className="size-4" /> Send email
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function TemplateForm({ template }: { template?: { id: string; name: string; subject: string; body: string; active: boolean } }) {
  const p = template?.id ?? "new";
  return (
    <ActionForm action={saveTemplateAction} resetOnSuccess={!template} className="grid gap-3">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            {template && <input type="hidden" name="id" value={template.id} />}
            <Input id={`tp-${p}-name`} name="name" label="Name" defaultValue={template?.name} maxLength={80} error={e.name} />
            <Input id={`tp-${p}-subject`} name="subject" label="Subject" defaultValue={template?.subject} maxLength={200} error={e.subject} />
            <div>
              <label htmlFor={`tp-${p}-body`} className="a-label">
                Message
              </label>
              <textarea id={`tp-${p}-body`} name="body" defaultValue={template?.body} rows={9} maxLength={8000} className="a-field font-mono text-[0.8rem]" aria-invalid={!!e.body} />
              <FieldError error={e.body} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="hidden" name="active" value="off" />
                <input type="checkbox" name="active" value="on" defaultChecked={template?.active ?? true} className="size-4" /> Offer this template when writing emails
              </label>
              <SubmitButton>{template ? "Save template" : "Add template"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
