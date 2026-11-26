"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { candidateNoteAction } from "../../../actions/candidates";

export function CandidateNoteForm({ id, applications }: { id: string; applications: { id: string; label: string }[] }) {
  return (
    <ActionForm action={candidateNoteAction} resetOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <label htmlFor="c-note" className="sr-only">
            Add a note
          </label>
          <textarea id="c-note" name="body" rows={3} maxLength={4000} placeholder="Add a note (call summary, feedback, next steps…)" aria-invalid={!!state.errors?.body} className="a-field" />
          <FieldError error={state.errors?.body} />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {applications.length > 0 && (
              <>
                <label htmlFor="c-note-app" className="text-xs text-muted">
                  About
                </label>
                <select id="c-note-app" name="applicationId" defaultValue="" className="a-field !w-auto !py-1.5 text-sm">
                  <option value="">The candidate in general</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
