/** Labels and option lists shared by the admin UI, the API and validation. */

/** The recruitment pipeline, in order. "rejected" and "on_hold" sit outside the main flow. */
export const APPLICATION_STATUSES = [
  "new",
  "screening",
  "shortlisted",
  "interview_scheduled",
  "interview_completed",
  "selected",
  "offer_released",
  "hired",
  "rejected",
  "on_hold",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New Application",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  selected: "Selected",
  offer_released: "Offer Released",
  hired: "Hired",
  rejected: "Rejected",
  on_hold: "On Hold",
};
/** The forward stages used for conversion figures (each one counts everyone who reached it or went further). */
export const FUNNEL_STAGES = ["new", "screening", "shortlisted", "interview_scheduled", "interview_completed", "selected", "offer_released", "hired"] as const;
/** Stages that count as "shortlisted or further along" on summary cards. */
export const ACTIVE_SHORTLIST: ApplicationStatus[] = ["shortlisted", "interview_scheduled", "interview_completed", "selected", "offer_released"];

export const CANDIDATE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type CandidatePriority = (typeof CANDIDATE_PRIORITIES)[number];
export const CANDIDATE_PRIORITY_LABELS: Record<CandidatePriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const AVAILABILITY_OPTIONS = ["Immediately", "Within 15 days", "Within 30 days", "Within 60 days", "Within 90 days", "Not looking"] as const;

export const APPLICATION_SOURCES = ["job", "careers", "cv_upload"] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];
export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  job: "Job opening",
  careers: "Careers form",
  cv_upload: "CV upload",
};

export const OPENING_STATUSES = ["draft", "published", "paused", "closed"] as const;
export type OpeningStatus = (typeof OPENING_STATUSES)[number];
export const OPENING_STATUS_LABELS: Record<OpeningStatus, string> = {
  draft: "Draft",
  published: "Published",
  paused: "Paused",
  closed: "Closed",
};

export const WORK_MODES = ["Onsite", "Hybrid", "Remote"] as const;
export const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Contract-to-hire", "Internship"] as const;
export const OPENING_EXPERIENCE = ["Fresher / 0 years", "0–1 year", "1–3 years", "3–5 years", "5–8 years", "8+ years"] as const;

export const ENQUIRY_STATUSES = ["new", "contacted", "converted", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

export const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Past 7 days" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Past 30 days" },
  { key: "all", label: "All time" },
] as const;
export type DateRangeKey = (typeof DATE_RANGES)[number]["key"];

/** IST calendar boundaries for the quick date ranges, as YYYY-MM-DD. */
export function dateRange(key: string, now = new Date()): { from?: string; to?: string } {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (days: number) => day(new Date(ist.getTime() - days * 86400_000));
  switch (key) {
    case "today":
      return { from: day(ist), to: day(ist) };
    case "yesterday":
      return { from: shift(1), to: shift(1) };
    case "7d":
      return { from: shift(6), to: day(ist) };
    case "30d":
      return { from: shift(29), to: day(ist) };
    case "month":
      return { from: `${day(ist).slice(0, 8)}01`, to: day(ist) };
    default:
      return {};
  }
}
