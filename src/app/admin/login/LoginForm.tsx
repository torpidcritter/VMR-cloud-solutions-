"use client";

import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { signInAction } from "../actions/auth";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signInAction} className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="a-label">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.data?.email} className="a-field" autoFocus />
          </div>
          <div>
            <label htmlFor="password" className="a-label">
              Password
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="a-field" />
          </div>
          <SubmitButton className="a-btn a-btn-primary w-full !min-h-11" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
          <p className="text-xs text-muted">Forgot your password? Ask a Super Admin to reset it.</p>
        </>
      )}
    </ActionForm>
  );
}
