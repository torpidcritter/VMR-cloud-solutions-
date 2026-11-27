"use client";

import { createContext, startTransition, useActionState, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "./Toaster";

/**
 * `persist` keeps a success message on the page (for things like a temporary
 * password); otherwise success shows as a toast.
 */
export type ActionState = { ok?: boolean; error?: string; message?: string; persist?: boolean; errors?: Record<string, string>; data?: Record<string, string> };
export type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Pending state of the surrounding ActionForm (which submits without React's automatic form reset). */
const FormPending = createContext(false);

export function SubmitButton({ children, className = "a-btn a-btn-primary", pendingLabel }: { children: ReactNode; className?: string; pendingLabel?: string }) {
  const status = useFormStatus();
  const formPending = useContext(FormPending);
  const pending = status.pending || formPending;
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
  // The toast is raised as soon as the action answers, so it still shows when
  // the refreshed page no longer renders this form (an item that moved away).
  const withToast = useCallback(
    async (prev: ActionState, form: FormData) => {
      const next = await action(prev, form);
      if (next?.ok && next.message && !next.persist) toast(next.message);
      return next;
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(withToast, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      // Submitting through the action prop makes React clear the form afterwards,
      // which would wipe what was typed when the server sends back an error.
      // With JavaScript we submit by hand and reset only on success (resetOnSuccess).
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
      className={className}
      noValidate
    >
      <FormPending.Provider value={pending}>
      {state.error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-accent-600 dark:bg-red-950/40 dark:text-accent-400">
          {state.error}
        </p>
      )}
      {state.ok && state.message && state.persist && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.message}
        </p>
      )}
      {typeof children === "function" ? children(state) : children}
      </FormPending.Provider>
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

/** A button that asks for confirmation in a dialog, then submits a server action. */
export function ConfirmButton({
  action,
  children,
  confirm,
  title = "Are you sure?",
  confirmLabel,
  className = "a-btn a-btn-danger",
  hidden = {},
}: {
  action: (form: FormData) => void | Promise<void>;
  children: ReactNode;
  confirm: string;
  title?: string;
  confirmLabel?: string;
  className?: string;
  hidden?: Record<string, string>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-navy-950/50"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <form action={action} className="p-6">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-ink-soft">{confirm}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="a-btn" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <SubmitButton className="a-btn a-btn-primary !border-accent-600 !bg-accent-600" pendingLabel="Working…">
              {confirmLabel ?? children}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Dialog shell used by bulk actions and other client-side confirmations. */
export function useConfirm() {
  const [pending, setPending] = useState<{ title: string; message: string; resolve: (ok: boolean) => void } | null>(null);
  const ask = (title: string, message: string) => new Promise<boolean>((resolve) => setPending({ title, message, resolve }));
  const node = pending ? (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-navy-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-lift)]">
        <h2 id="confirm-title" className="text-base font-semibold">
          {pending.title}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{pending.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="a-btn"
            autoFocus
            onClick={() => {
              pending.resolve(false);
              setPending(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary"
            onClick={() => {
              pending.resolve(true);
              setPending(null);
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, node };
}
