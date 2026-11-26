"use client";

import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { verifyCodeAction } from "../../actions/auth";

export function VerifyForm({ next }: { next: string }) {
  return (
    <ActionForm action={verifyCodeAction} className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="code" className="a-label">
              Code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={12}
              aria-invalid={!!state.error}
              className="a-field text-center font-mono text-lg tracking-[0.3em]"
              autoFocus
            />
          </div>
          <SubmitButton className="a-btn a-btn-primary w-full !min-h-11" pendingLabel="Checking…">
            Verify and sign in
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
