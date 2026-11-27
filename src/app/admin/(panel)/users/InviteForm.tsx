"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { inviteUserAction } from "../../actions/users";

export function InviteForm() {
  return (
    <ActionForm action={inviteUserAction} className="grid gap-3" resetOnSuccess>
      {(state) => (
        <>
          <div>
            <label htmlFor="name" className="a-label">
              Name
            </label>
            <input id="name" name="name" defaultValue={state.data?.name} aria-invalid={!!state.errors?.name} className="a-field" />
            <FieldError error={state.errors?.name} />
          </div>
          <div>
            <label htmlFor="email" className="a-label">
              Email
            </label>
            <input id="email" name="email" type="email" defaultValue={state.data?.email} aria-invalid={!!state.errors?.email} className="a-field" />
            <FieldError error={state.errors?.email} />
          </div>
          <div>
            <label htmlFor="role" className="a-label">
              Role
            </label>
            <select id="role" name="role" defaultValue={state.data?.role ?? "recruiter"} aria-invalid={!!state.errors?.role} className="a-field">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <FieldError error={state.errors?.role} />
          </div>
          <p className="text-xs text-muted">A temporary password is shown once after you add them. They must change it at first sign-in.</p>
          <div>
            <SubmitButton pendingLabel="Adding…">Add user</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
