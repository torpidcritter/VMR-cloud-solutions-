"use client";

import { ActionForm, SubmitButton, type ActionState } from "@/components/admin/forms";
import { confirmMfaSetupAction, disableOwnMfaAction, newRecoveryCodesAction, startMfaSetupAction } from "../actions/security";

function CodeField({ id = "code", label = "Code from your app" }: { id?: string; label?: string }) {
  return (
    <div>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      <input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} className="a-field font-mono tracking-[0.2em]" />
    </div>
  );
}

function Codes({ state }: { state: ActionState }) {
  const codes = state.data?.codes?.split(" ").filter(Boolean) ?? [];
  if (!codes.length) return null;
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm font-semibold">Save these recovery codes now</p>
      <p className="mt-1 text-xs text-muted">They won&rsquo;t be shown again. Keep them somewhere safe, away from your phone. Each works once.</p>
      <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <a href="/admin" className="a-btn a-btn-primary mt-4">
        I&rsquo;ve saved them, continue
      </a>
    </div>
  );
}

export function StartSetupForm() {
  return (
    <form action={startMfaSetupAction}>
      <button type="submit" className="a-btn a-btn-primary w-full !min-h-11">
        Set up two-step sign-in
      </button>
    </form>
  );
}

export function ConfirmSetupForm() {
  return (
    <ActionForm action={confirmMfaSetupAction} className="grid gap-3">
      {(state) =>
        state.ok ? (
          <Codes state={state} />
        ) : (
          <>
            <CodeField />
            <SubmitButton className="a-btn a-btn-primary w-full !min-h-11" pendingLabel="Checking…">
              Turn on two-step sign-in
            </SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}

export function RecoveryCodesForm() {
  return (
    <ActionForm action={newRecoveryCodesAction} className="mt-3 grid gap-3">
      {(state) =>
        state.ok ? (
          <Codes state={state} />
        ) : (
          <>
            <CodeField id="rc-code" />
            <SubmitButton className="a-btn" pendingLabel="Making codes…">
              Make new recovery codes
            </SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}

export function DisableForm() {
  return (
    <ActionForm action={disableOwnMfaAction} className="mt-3 grid gap-3">
      <div>
        <label htmlFor="off-password" className="a-label">
          Your password
        </label>
        <input id="off-password" name="password" type="password" autoComplete="current-password" required className="a-field" />
      </div>
      <CodeField id="off-code" />
      <SubmitButton className="a-btn" pendingLabel="Turning off…">
        Turn off two-step sign-in
      </SubmitButton>
    </ActionForm>
  );
}
