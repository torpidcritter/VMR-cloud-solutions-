import type { ReactNode } from "react";

export function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-accent-600">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Hidden field that only bots fill in. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="website">Leave this field empty</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: boolean) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
