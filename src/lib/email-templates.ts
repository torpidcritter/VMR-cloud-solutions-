/**
 * Merge fields for candidate emails. Pure functions, used by the compose box
 * in the browser (live preview) and again on the server before sending.
 *
 * Only facts about the candidate, the role title and the interview are
 * available. The confidential client name is never a merge field.
 */

export const MERGE_FIELDS = [
  { key: "candidate_first_name", label: "Candidate's first name" },
  { key: "candidate_name", label: "Candidate's full name" },
  { key: "position", label: "Role title" },
  { key: "recruiter_name", label: "Your name" },
  { key: "interview_round", label: "Interview round" },
  { key: "interview_date", label: "Interview date" },
  { key: "interview_time", label: "Interview time (India)" },
  { key: "interview_mode", label: "Interview mode" },
  { key: "interview_location", label: "Interview link or address" },
] as const;

export type MergeKey = (typeof MERGE_FIELDS)[number]["key"];
export type MergeValues = Partial<Record<MergeKey, string>>;

const FIELD_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Replaces known fields that have a value. Anything else is left as written, so it can be spotted. */
export function renderTemplate(text: string, values: MergeValues) {
  return text.replace(FIELD_RE, (whole, key: string) => {
    const v = values[key as MergeKey];
    return v ? v : whole;
  });
}

/** Fields still in the text after rendering, such as {{interview_date}} when no interview is booked. */
export function unfilledFields(text: string) {
  return [...new Set([...text.matchAll(FIELD_RE)].map((m) => m[1]))];
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

/** A subject can't carry line breaks (they would let someone add mail headers). */
export const cleanSubject = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The HTML part of an email: the plain text, escaped, with its paragraphs and line breaks kept. */
export function bodyToHtml(text: string) {
  const paras = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#0f1b33">${paras}</div>`;
}
