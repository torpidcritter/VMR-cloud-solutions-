import { APPLICATION_STATUS_LABELS, CANDIDATE_PRIORITY_LABELS } from "@/lib/data/constants";

import { Badge, type Tone } from "./ui";

const PRIORITY_TONE: Record<string, Tone> = { low: "grey", normal: "grey", high: "amber", urgent: "red" };

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "grey"}>{CANDIDATE_PRIORITY_LABELS[priority as keyof typeof CANDIDATE_PRIORITY_LABELS] ?? priority}</Badge>;
}

export function TagList({ items, more = 0, tone = "blue" }: { items: string[]; more?: number; tone?: Tone }) {
  if (!items.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((t) => (
        <Badge key={t} tone={tone}>
          {t}
        </Badge>
      ))}
      {more > 0 && <span className="text-xs text-muted">+{more}</span>}
    </span>
  );
}

const STATUS_LABEL = (s: string | null) => APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS] ?? s ?? "—";
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : Array.isArray(v) ? (v.length ? v.join(", ") : "empty") : v === "now" ? "now" : String(v));

/** One line of a candidate's or application's history, worded for people. */
export function EventText({ e }: { e: { kind: string; body: string; from_status: string | null; to_status: string | null; details?: Record<string, unknown> | null } }) {
  switch (e.kind) {
    case "note":
      return <p className="mt-1 whitespace-pre-line">{e.body}</p>;
    case "status":
      return (
        <p className="mt-1">
          Moved from <strong>{STATUS_LABEL(e.from_status)}</strong> to <strong>{STATUS_LABEL(e.to_status)}</strong>
        </p>
      );
    case "assign":
      return <p className="mt-1">{e.body ? <>Assigned to <strong>{e.body}</strong></> : "Recruiter removed (unassigned)"}</p>;
    case "edit": {
      const changes = (e.details?.changes ?? {}) as Record<string, [unknown, unknown]>;
      const keys = Object.keys(changes);
      if (!keys.length) return <p className="mt-1">Updated {e.body}</p>;
      return (
        <ul className="mt-1 grid gap-0.5">
          {keys.map((k) => (
            <li key={k}>
              <span className="text-muted">{k}:</span> {k === "Summary" || k === "Qualifications" ? "updated" : <>{show(changes[k][0])} → <strong>{show(changes[k][1])}</strong></>}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <p className="mt-1 whitespace-pre-line">{e.body || e.kind}</p>;
  }
}

export const EVENT_KIND_LABELS: Record<string, string> = {
  note: "Note",
  status: "Stage",
  assign: "Assignment",
  edit: "Profile",
  email: "Email",
  interview: "Interview",
  task: "Task",
  merge: "Merge",
};
