"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: boolean; error?: string; message?: string; errors?: Record<string, string>; data?: Record<string, string> };
export type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className = "a-btn a-btn-primary", pendingLabel }: { children: ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

/**
 * A form bound to a server action. Shows the action's error or success
 * message and passes field errors down through a render function.
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {state.error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-accent-600 dark:bg-red-950/40 dark:text-accent-400">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.message}
        </p>
      )}
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}

export function FieldError({ error, id }: { error?: string; id?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-xs text-accent-600">
      {error}
    </p>
  );
}

/** A small form with one button that asks for confirmation first. */
export function ConfirmButton({
  action,
  children,
  confirm,
  className = "a-btn a-btn-danger",
  hidden = {},
}: {
  action: (form: FormData) => void | Promise<void>;
  children: ReactNode;
  confirm: string;
  className?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} pendingLabel="Working…">
        {children}
      </SubmitButton>
    </form>
  );
}
