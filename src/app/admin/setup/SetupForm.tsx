"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { setupAction } from "../actions/auth";

export function SetupForm() {
  return (
    <ActionForm action={setupAction} className="space-y-4">
      {(state) => (
        <>
          <div>
            <label htmlFor="setupKey" className="a-label">
              Setup key
            </label>
            <input id="setupKey" name="setupKey" type="password" autoComplete="off" className="a-field" />
            <p className="mt-1 text-xs text-muted">The ADMIN_SETUP_KEY value from Vercel.</p>
          </div>
          <div>
            <label htmlFor="name" className="a-label">
              Your name
            </label>
            <input id="name" name="name" autoComplete="name" defaultValue={state.data?.name} aria-invalid={!!state.errors?.name} className="a-field" />
            <FieldError error={state.errors?.name} />
          </div>
          <div>
            <label htmlFor="email" className="a-label">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" defaultValue={state.data?.email} aria-invalid={!!state.errors?.email} className="a-field" />
            <FieldError error={state.errors?.email} />
          </div>
          <div>
            <label htmlFor="password" className="a-label">
              Password
            </label>
            <input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!state.errors?.password} className="a-field" />
            <FieldError error={state.errors?.password} />
            {!state.errors?.password && <p className="mt-1 text-xs text-muted">At least 10 characters, with letters and a number.</p>}
          </div>
          <div>
            <label htmlFor="confirm" className="a-label">
              Confirm password
            </label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!state.errors?.confirm} className="a-field" />
            <FieldError error={state.errors?.confirm} />
          </div>
          <SubmitButton className="a-btn a-btn-primary w-full !min-h-11" pendingLabel="Creating…">
            Create account and sign in
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
