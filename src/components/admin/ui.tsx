import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { APPLICATION_STATUS_LABELS, ENQUIRY_STATUS_LABELS, OPENING_STATUS_LABELS } from "@/lib/data/constants";

/** Small building blocks shared by the admin pages (server-safe). */

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  blue: "bg-brand-50 text-brand-600",
  cyan: "bg-sky-soft text-[#0089b3] dark:bg-[#0c2a3a] dark:text-sky-brand",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-50 text-accent-600 dark:bg-red-950/40 dark:text-accent-400",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  grey: "bg-surface-2 text-ink-soft",
} as const;
export type Tone = keyof typeof TONES;

export function StatCard({ label, value, icon: Icon, tone = "blue", hint, href }: { label: string; value: number | string; icon: LucideIcon; tone?: Tone; hint?: string; href?: string }) {
  const body = (
    <>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold tabular-nums text-ink">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</span>
        <span className="block truncate text-sm text-muted">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = "card flex items-center gap-4 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-brand-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Badge({ children, tone = "grey" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

const APP_TONES: Record<string, Tone> = {
  new: "blue",
  screening: "amber",
  shortlisted: "violet",
  interview_scheduled: "cyan",
  interview_completed: "cyan",
  selected: "green",
  offer_released: "green",
  hired: "green",
  rejected: "red",
  on_hold: "grey",
};
export function ApplicationStatusBadge({ status }: { status: string }) {
  return <Badge tone={APP_TONES[status] ?? "grey"}>{APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS] ?? status}</Badge>;
}

const OPENING_TONES: Record<string, Tone> = { draft: "grey", published: "green", paused: "amber", closed: "red" };
export function OpeningStatusBadge({ status }: { status: string }) {
  return <Badge tone={OPENING_TONES[status] ?? "grey"}>{OPENING_STATUS_LABELS[status as keyof typeof OPENING_STATUS_LABELS] ?? status}</Badge>;
}

const ENQ_TONES: Record<string, Tone> = { new: "blue", contacted: "amber", converted: "green", closed: "grey" };
export function EnquiryStatusBadge({ status }: { status: string }) {
  return <Badge tone={ENQ_TONES[status] ?? "grey"}>{ENQUIRY_STATUS_LABELS[status as keyof typeof ENQUIRY_STATUS_LABELS] ?? status}</Badge>;
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="card grid place-items-center gap-2 px-6 py-14 text-center">
      {Icon && <Icon aria-hidden className="size-8 text-brand-300" />}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = "", bodyClass = "p-5" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** "12 Nov 2026, 3:04 pm" in India time. */
export function formatDateTime(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function formatDate(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span>
        Page {page} of {pages} · {total.toLocaleString("en-IN")} total
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link className="a-btn" href={href(page - 1)}>
            Previous
          </Link>
        ) : (
          <span className="a-btn opacity-50">Previous</span>
        )}
        {page < pages ? (
          <Link className="a-btn" href={href(page + 1)}>
            Next
          </Link>
        ) : (
          <span className="a-btn opacity-50">Next</span>
        )}
      </span>
    </nav>
  );
}

/** Builds a URL from the current filters with some values replaced. */
export function withParams(base: string, current: Record<string, string | undefined>, changes: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export function Notice({ tone = "blue", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${TONES[tone]}`}>{children}</div>;
}
