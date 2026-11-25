"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { addNoteAction } from "../../../actions/applications";

export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm action={addNoteAction} resetOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <label htmlFor="body" className="sr-only">
            Add a note
          </label>
          <textarea id="body" name="body" rows={3} maxLength={4000} placeholder="Add a note for the team (interview feedback, next steps…)" aria-invalid={!!state.errors?.body} className="a-field" />
          <FieldError error={state.errors?.body} />
          <div className="mt-2 flex justify-end">
            <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
