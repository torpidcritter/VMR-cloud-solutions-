import Link from "next/link";
import { CalendarClock, MapPin, Phone, Video } from "lucide-react";
import { INTERVIEW_MODE_LABELS, INTERVIEW_STATUS_LABELS, type InterviewMode, type InterviewStatus } from "@/lib/data/constants";
import type { Interview } from "@/lib/data/interviews";
import { Badge, type Tone } from "./ui";

const STATUS_TONE: Record<InterviewStatus, Tone> = { scheduled: "blue", completed: "green", cancelled: "grey", no_show: "red" };
const MODE_ICON: Record<InterviewMode, typeof Video> = { video: Video, phone: Phone, in_person: MapPin };

export function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{INTERVIEW_STATUS_LABELS[status]}</Badge>;
}

export const ist = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
export const istTime = (iso: string) => ist(iso, { hour: "numeric", minute: "2-digit" });
export const istDay = (iso: string) => ist(iso, { weekday: "short", day: "numeric", month: "short" });

/** One interview as a row: when, who, which round, how. */
export function InterviewRow({ i, showCandidate = true }: { i: Interview; showCandidate?: boolean }) {
  const Icon = MODE_ICON[i.mode];
  return (
    <li className="flex items-start gap-x-3 gap-y-1 px-4 py-3 text-sm sm:gap-x-4 sm:px-5">
      <div className="w-[4.5rem] shrink-0 sm:w-28">
        <p className="font-semibold tabular-nums">{istTime(i.scheduled_at)}</p>
        <p className="text-xs text-muted">{istDay(i.scheduled_at)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/admin/interviews/${i.id}`} className="font-medium hover:text-brand-600">
          {showCandidate ? `${i.candidate_name} · ${i.round}` : i.round}
        </Link>
        <p className="text-xs text-muted sm:truncate">
          {i.opening_title ?? i.position} · <Icon aria-hidden className="inline size-3" /> {INTERVIEW_MODE_LABELS[i.mode]} · {i.duration_minutes} min · {i.panel.map((p) => p.name).join(", ") || "No panel"}
        </p>
      </div>
      <InterviewStatusBadge status={i.status} />
    </li>
  );
}

export function InterviewList({ items, empty, showCandidate = true }: { items: Interview[]; empty: string; showCandidate?: boolean }) {
  if (!items.length)
    return (
      <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted">
        <CalendarClock aria-hidden className="size-4" /> {empty}
      </p>
    );
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <InterviewRow key={i.id} i={i} showCandidate={showCandidate} />
      ))}
    </ul>
  );
}
