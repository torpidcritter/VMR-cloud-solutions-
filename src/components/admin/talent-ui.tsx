"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, Upload, UserPlus } from "lucide-react";
import { ActionForm, FieldError, SubmitButton } from "./forms";
import { CV_ACCEPT } from "@/lib/cv";
import {
  addMatchingToPoolAction,
  addToPoolAction,
  createCandidateAction,
  putForwardAction,
  readResumeTextAction,
  savePoolAction,
  uploadCandidateFileAction,
} from "@/app/admin/actions/talent";
import type { Match } from "@/lib/matching";

export function UploadResumeForm({ candidateId }: { candidateId: string }) {
  return (
    <ActionForm action={uploadCandidateFileAction} resetOnSuccess className="grid gap-2">
      {(state) => (
        <>
          <input type="hidden" name="candidateId" value={candidateId} />
          <label htmlFor="upload-file" className="a-label">
            Upload a resume
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="upload-file"
              name="file"
              type="file"
              accept={CV_ACCEPT}
              className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
              aria-invalid={!!state.errors?.file}
              aria-describedby="upload-help"
            />
            <SubmitButton className="a-btn" pendingLabel="Uploading…">
              <Upload aria-hidden className="size-4" /> Upload
            </SubmitButton>
          </div>
          <p id="upload-help" className="text-xs text-muted">
            PDF, DOC or DOCX up to 4 MB. Its text is read so it can be searched and matched.
          </p>
          <FieldError error={state.errors?.file} />
        </>
      )}
    </ActionForm>
  );
}

export function AddToPoolForm({ candidateId, pools }: { candidateId: string; pools: { id: string; name: string }[] }) {
  if (!pools.length) return null;
  return (
    <ActionForm action={addToPoolAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="add-pool" className="a-label">
          Add to a pool
        </label>
        <select id="add-pool" name="poolId" className="a-field" defaultValue="">
          <option value="" disabled>
            Choose a pool
          </option>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton className="a-btn">Add</SubmitButton>
    </ActionForm>
  );
}

/** "Put forward" for one candidate and one opening; shows a link to the new application once done. */
export function PutForwardButton({ candidateId, openingId, label = "Put forward" }: { candidateId: string; openingId: string; label?: string }) {
  return (
    <ActionForm action={putForwardAction} className="contents">
      {(state) =>
        state.ok && state.data?.applicationId ? (
          <Link href={`/admin/applications/${state.data.applicationId}`} className="a-btn">
            <CheckCircle2 aria-hidden className="size-4 text-emerald-600" /> In pipeline
          </Link>
        ) : (
          <>
            <input type="hidden" name="candidateId" value={candidateId} />
            <input type="hidden" name="openingId" value={openingId} />
            <SubmitButton className="a-btn" pendingLabel="Adding…">
              <UserPlus aria-hidden className="size-4" /> {label}
            </SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}

export function MatchReasons({ match }: { match: Match }) {
  return (
    <ul className="mt-1.5 grid gap-1 text-xs">
      {match.reasons.map((r, i) => (
        <li key={i} className={`flex items-start gap-1.5 ${r.ok ? "text-ink-soft" : "text-muted"}`}>
          {r.ok ? <CheckCircle2 aria-hidden className="mt-px size-3.5 shrink-0 text-emerald-600" /> : <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-amber-500" />}
          <span>
            <span className="sr-only">{r.ok ? "Match: " : "Gap: "}</span>
            {r.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-muted";
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-current text-sm font-bold tabular-nums ${tone}`} title={`Match score ${score} out of 100`}>
      {score}
      <span className="sr-only"> out of 100</span>
    </span>
  );
}

export function PoolForm({ pool }: { pool?: { id: string; name: string; description: string } }) {
  return (
    <ActionForm action={savePoolAction} resetOnSuccess={!pool} className="grid gap-3">
      {(state) => (
        <>
          {pool && <input type="hidden" name="id" value={pool.id} />}
          <div>
            <label htmlFor="pool-name" className="a-label">
              Name
            </label>
            <input id="pool-name" name="name" defaultValue={pool?.name} maxLength={80} placeholder="e.g. S/4HANA FICO – Bengaluru" className="a-field" aria-invalid={!!state.errors?.name} />
            <FieldError error={state.errors?.name} />
          </div>
          <div>
            <label htmlFor="pool-description" className="a-label">
              What it&apos;s for <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id="pool-description" name="description" defaultValue={pool?.description} maxLength={500} rows={2} className="a-field" />
          </div>
          <div className="flex justify-end">
            <SubmitButton>{pool ? "Save pool" : "Create pool"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function AddMatchingToPool({ pools, filters, total }: { pools: { id: string; name: string }[]; filters: Record<string, string | undefined>; total: number }) {
  return (
    <ActionForm action={addMatchingToPoolAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(filters).map(([k, v]) => (v ? <input key={k} type="hidden" name={`f_${k}`} value={v} /> : null))}
      <label htmlFor="bulk-pool" className="text-sm text-muted">
        Add {total > 2000 ? "the first 2,000" : total === 1 ? "this candidate" : `all ${total.toLocaleString("en-IN")}`} to
      </label>
      <select id="bulk-pool" name="poolId" className="a-field !w-auto !py-1.5 text-sm" defaultValue="">
        <option value="" disabled>
          a talent pool…
        </option>
        {pools.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <SubmitButton className="a-btn" pendingLabel="Adding…">
        Add
      </SubmitButton>
    </ActionForm>
  );
}

export function ReadResumeTextButton() {
  return (
    <ActionForm action={readResumeTextAction} className="flex justify-start">
      <SubmitButton className="a-btn" pendingLabel="Reading…">
        Read the next 20
      </SubmitButton>
    </ActionForm>
  );
}

export function NewCandidateForm() {
  return (
    <ActionForm action={createCandidateAction} className="grid gap-4 sm:grid-cols-2">
      {(state) => {
        const e = state.errors ?? {};
        const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = false) => (
          <div className={span ? "sm:col-span-2" : ""}>
            <label htmlFor={`nc-${name}`} className="a-label">
              {label}
            </label>
            <input id={`nc-${name}`} name={name} className="a-field" aria-invalid={!!e[name]} aria-describedby={e[name] ? `nc-${name}-error` : undefined} {...props} />
            <FieldError id={`nc-${name}-error`} error={e[name]} />
          </div>
        );
        return (
          <>
            {state.data?.existing && (
              <p className="text-sm sm:col-span-2">
                <Link href={`/admin/candidates/${state.data.existing}`} className="font-medium text-brand-600 hover:underline">
                  Open their existing profile →
                </Link>
              </p>
            )}
            {field("fullName", "Full name", { autoComplete: "off", maxLength: 120 })}
            {field("email", "Email", { type: "email", autoComplete: "off", maxLength: 200 })}
            {field("phone", "Phone (optional)", { type: "tel", maxLength: 30 })}
            {field("location", "Location (optional)", { maxLength: 120 })}
            {field("currentTitle", "Current role (optional)", { maxLength: 120 })}
            {field("experienceYears", "Years of experience (optional)", { type: "number", min: 0, max: 60, step: 0.5, inputMode: "decimal" })}
            {field("skills", "Skills, separated by commas (optional)", { placeholder: "e.g. SAP FI, SAP CO, S/4HANA", maxLength: 1000 }, true)}
            <div className="sm:col-span-2">
              <label htmlFor="nc-summary" className="a-label">
                Summary (optional)
              </label>
              <textarea id="nc-summary" name="summary" rows={3} maxLength={2000} className="a-field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="nc-file" className="a-label">
                Resume (optional)
              </label>
              <input
                id="nc-file"
                name="file"
                type="file"
                accept={CV_ACCEPT}
                className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
                aria-invalid={!!e.file}
              />
              <p className="mt-1 text-xs text-muted">PDF, DOC or DOCX up to 4 MB. Its text is read for resume search and job matching.</p>
              <FieldError error={e.file} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton pendingLabel="Adding…">Add to Talent Bank</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
