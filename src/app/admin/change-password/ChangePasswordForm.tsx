"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { changePasswordAction } from "../actions/auth";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} className="space-y-4">
      {(state) => (
        <>
          <div>
            <label htmlFor="current" className="a-label">
              Current password
            </label>
            <input id="current" name="current" type="password" autoComplete="current-password" aria-invalid={!!state.errors?.current} className="a-field" />
            <FieldError error={state.errors?.current} />
          </div>
          <div>
            <label htmlFor="password" className="a-label">
              New password
            </label>
            <input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!state.errors?.password} className="a-field" />
            <FieldError error={state.errors?.password} />
            {!state.errors?.password && <p className="mt-1 text-xs text-muted">At least 10 characters, with letters and a number.</p>}
          </div>
          <div>
            <label htmlFor="confirm" className="a-label">
              Confirm new password
            </label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!state.errors?.confirm} className="a-field" />
            <FieldError error={state.errors?.confirm} />
          </div>
          <SubmitButton className="a-btn a-btn-primary w-full !min-h-11">Save password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
