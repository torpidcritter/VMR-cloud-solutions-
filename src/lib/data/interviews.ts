import "server-only";
import { randomUUID } from "node:crypto";
import { db, type Statement } from "@/lib/db/client";
import {
  INTERVIEW_MODES,
  INTERVIEW_MODE_LABELS,
  RECOMMENDATIONS,
  RECOMMENDATION_LABELS,
  type InterviewMode,
  type InterviewStatus,
  type Recommendation,
} from "./constants";

/**
 * Interviews belong to an application. Scheduling one moves the application to
 * "Interview Scheduled"; completing it (or recording feedback) moves it to
 * "Interview Completed". Each change also lands on the candidate's timeline.
 * Times are entered and shown in India time (IST, UTC+5:30).
 */

const isUuid = (v?: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type InterviewInput = {
  round: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  location: string;
  notes: string;
  panel: string[];
};

/** "2026-12-01" + "14:30" in IST → ISO timestamp. */
export function istToIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO timestamp → { date, time } in IST, for form defaults. */
export function isoToIst(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

export function parseInterview(form: Record<string, unknown>, panel: string[], now = Date.now()): { data: InterviewInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const scheduledAt = istToIso(str(form.date, 10), str(form.time, 5));
  const duration = Number(str(form.duration, 4) || 60);
  const mode = str(form.mode, 20) as InterviewMode;
  const data: InterviewInput = {
    round: str(form.round, 80),
    scheduledAt: scheduledAt ?? "",
    durationMinutes: duration,
    mode,
    location: str(form.location, 300),
    notes: str(form.notes, 2000),
    panel: [...new Set(panel.filter(isUuid))].slice(0, 10),
  };
  if (!data.round) errors.round = "Name the round, for example Technical round 1.";
  if (!scheduledAt) errors.date = "Choose a date and time.";
  else {
    const t = new Date(scheduledAt).getTime();
    if (t < now - 30 * 86_400_000) errors.date = "That date is more than 30 days ago.";
    else if (t > now + 366 * 86_400_000) errors.date = "Choose a date within the next year.";
  }
  if (!Number.isInteger(duration) || duration < 10 || duration > 480) errors.duration = "Choose a length between 10 minutes and 8 hours.";
  if (!(INTERVIEW_MODES as readonly string[]).includes(mode)) errors.mode = "Choose how the interview happens.";
  if (data.location && mode === "video" && !/^https:\/\/\S+$/i.test(data.location)) errors.location = "Paste the meeting link (starting with https://).";
  if (!data.panel.length) errors.panel = "Choose at least one interviewer.";
  return { data, errors };
}

export type Interview = {
  id: string;
  application_id: string;
  application_number: string;
  application_status: string;
  position: string;
  opening_title: string | null;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  round: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  location: string;
  status: InterviewStatus;
  notes: string;
  cancel_reason: string;
  created_by_name: string | null;
  created_at: string;
  panel: { id: string; name: string; email: string }[];
  feedback_count: number;
};

export type Feedback = { id: string; user_id: string | null; user_name: string | null; rating: number; recommendation: Recommendation; notes: string; updated_at: string };

const SELECT = `SELECT i.id, i.application_id, a.number AS application_number, a.status AS application_status, a.position, o.title AS opening_title,
    c.id AS candidate_id, c.full_name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
    i.round, i.scheduled_at, i.duration_minutes, i.mode, i.location, i.status, i.notes, i.cancel_reason, cb.name AS created_by_name, i.created_at,
    COALESCE((SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email) ORDER BY u.name)
                FROM interview_panel p JOIN admin_users u ON u.id = p.user_id WHERE p.interview_id = i.id), '[]'::json) AS panel,
    (SELECT count(*)::int FROM interview_feedback f WHERE f.interview_id = i.id) AS feedback_count
  FROM interviews i
  JOIN applications a ON a.id = i.application_id
  JOIN candidates c ON c.id = a.candidate_id
  LEFT JOIN job_openings o ON o.id = a.opening_id
  LEFT JOIN admin_users cb ON cb.id = i.created_by`;

export async function getInterview(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Interview>(`${SELECT} WHERE i.id = $1`, [id]);
  if (!row) return null;
  const feedback = await conn.query<Feedback>(
    `SELECT f.id, f.user_id, u.name AS user_name, f.rating, f.recommendation, f.notes, f.updated_at
       FROM interview_feedback f LEFT JOIN admin_users u ON u.id = f.user_id WHERE f.interview_id = $1 ORDER BY f.updated_at`,
    [id],
  );
  return { ...row, feedback };
}

export type InterviewFilters = {
  from?: string;
  to?: string;
  /** Interviews this person sits on, or whose application they are assigned to. */
  userId?: string;
  status?: string;
  applicationId?: string;
  candidateId?: string;
};

export async function listInterviews(f: InterviewFilters, limit = 500) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (f.from) add((n) => `i.scheduled_at >= $${n}::timestamptz`, f.from);
  if (f.to) add((n) => `i.scheduled_at < $${n}::timestamptz`, f.to);
  if (isUuid(f.userId)) add((n) => `(a.assigned_to = $${n}::uuid OR EXISTS (SELECT 1 FROM interview_panel p WHERE p.interview_id = i.id AND p.user_id = $${n}::uuid))`, f.userId);
  if (f.status) add((n) => `i.status = $${n}`, f.status);
  if (isUuid(f.applicationId)) add((n) => `i.application_id = $${n}`, f.applicationId);
  if (isUuid(f.candidateId)) add((n) => `a.candidate_id = $${n}`, f.candidateId);
  const conn = await db();
  return conn.query<Interview>(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY i.scheduled_at LIMIT ${limit}`, params);
}

/**
 * Other scheduled interviews that overlap this slot for the same interviewers
 * or the same candidate. Shown as a warning before saving.
 */
export async function findConflicts(input: Pick<InterviewInput, "scheduledAt" | "durationMinutes" | "panel">, applicationId: string, excludeId?: string) {
  const conn = await db();
  return conn.query<{ id: string; scheduled_at: string; candidate_name: string; round: string; who: string }>(
    `SELECT i.id, i.scheduled_at, c.full_name AS candidate_name, i.round,
            COALESCE((SELECT string_agg(u.name, ', ') FROM interview_panel p JOIN admin_users u ON u.id = p.user_id
                       WHERE p.interview_id = i.id AND p.user_id = ANY($4::uuid[])), '') AS who
       FROM interviews i JOIN applications a ON a.id = i.application_id JOIN candidates c ON c.id = a.candidate_id
      WHERE i.status = 'scheduled' AND i.id <> COALESCE($5::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND i.scheduled_at < $1::timestamptz + ($2::int * interval '1 minute')
        AND i.scheduled_at + (i.duration_minutes * interval '1 minute') > $1::timestamptz
        AND (EXISTS (SELECT 1 FROM interview_panel p WHERE p.interview_id = i.id AND p.user_id = ANY($4::uuid[]))
             OR a.candidate_id = (SELECT candidate_id FROM applications WHERE id = $3))
      ORDER BY i.scheduled_at LIMIT 5`,
    [input.scheduledAt, input.durationMinutes, applicationId, input.panel, isUuid(excludeId) ? excludeId : null],
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function event(applicationId: string, userId: string, body: string, details: Record<string, unknown>): Statement {
  return {
    text: `INSERT INTO application_events (application_id, candidate_id, user_id, kind, body, details)
           SELECT a.id, a.candidate_id, $2, 'interview', $3, $4::jsonb FROM applications a WHERE a.id = $1`,
    params: [applicationId, userId, body.slice(0, 500), JSON.stringify(details)],
  };
}

/** Moves the application forward (never backward) and records the stage change. */
function advance(applicationId: string, userId: string, to: "interview_scheduled" | "interview_completed", fromStages: string[]): Statement[] {
  return [
    {
      text: `INSERT INTO application_events (application_id, candidate_id, user_id, kind, from_status, to_status)
             SELECT a.id, a.candidate_id, $2, 'status', a.status, $3 FROM applications a WHERE a.id = $1 AND a.status = ANY($4::text[])`,
      params: [applicationId, userId, to, fromStages],
    },
    {
      text: `UPDATE applications SET status = $2, stage_changed_at = now(), updated_at = now() WHERE id = $1 AND status = ANY($3::text[])`,
      params: [applicationId, to, fromStages],
    },
  ];
}

function panelStatements(id: string, panel: string[]): Statement[] {
  return [
    { text: `DELETE FROM interview_panel WHERE interview_id = $1`, params: [id] },
    {
      text: `INSERT INTO interview_panel (interview_id, user_id) SELECT $1, u.id FROM admin_users u WHERE u.id = ANY($2::uuid[]) AND u.active`,
      params: [id, panel],
    },
  ];
}

export async function scheduleInterview(applicationId: string, input: InterviewInput, userId: string) {
  if (!isUuid(applicationId)) return null;
  const conn = await db();
  const [app] = await conn.query<{ id: string }>(`SELECT id FROM applications WHERE id = $1`, [applicationId]);
  if (!app) return null;
  const id = randomUUID();
  await conn.tx([
    {
      text: `INSERT INTO interviews (id, application_id, round, scheduled_at, duration_minutes, mode, location, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params: [id, applicationId, input.round, input.scheduledAt, input.durationMinutes, input.mode, input.location, input.notes, userId],
    },
    ...panelStatements(id, input.panel),
    event(applicationId, userId, `${input.round} scheduled for ${fmt(input.scheduledAt)} (${INTERVIEW_MODE_LABELS[input.mode]})`, {
      interview_id: id,
      action: "scheduled",
      at: input.scheduledAt,
    }),
    ...advance(applicationId, userId, "interview_scheduled", ["new", "screening", "shortlisted", "interview_completed"]),
  ]);
  return id;
}

export async function rescheduleInterview(id: string, input: InterviewInput, userId: string) {
  const before = await getInterview(id);
  if (!before || before.status !== "scheduled") return false;
  const conn = await db();
  const moved = before.scheduled_at !== input.scheduledAt && new Date(before.scheduled_at).getTime() !== new Date(input.scheduledAt).getTime();
  await conn.tx([
    {
      text: `UPDATE interviews SET round = $2, scheduled_at = $3, duration_minutes = $4, mode = $5, location = $6, notes = $7,
               reminded_at = CASE WHEN scheduled_at <> $3::timestamptz THEN NULL ELSE reminded_at END, updated_at = now()
             WHERE id = $1 AND status = 'scheduled'`,
      params: [id, input.round, input.scheduledAt, input.durationMinutes, input.mode, input.location, input.notes],
    },
    ...panelStatements(id, input.panel),
    event(
      before.application_id,
      userId,
      moved ? `${input.round} moved from ${fmt(before.scheduled_at)} to ${fmt(input.scheduledAt)}` : `${input.round} details updated`,
      { interview_id: id, action: moved ? "rescheduled" : "updated", from: before.scheduled_at, at: input.scheduledAt },
    ),
  ]);
  return true;
}

/** Completed, cancelled or no-show. Only a scheduled interview can change. */
export async function setInterviewStatus(id: string, status: Exclude<InterviewStatus, "scheduled">, userId: string, reason = "") {
  const before = await getInterview(id);
  if (!before || before.status !== "scheduled") return false;
  const conn = await db();
  const label = status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "marked as a no-show";
  const [updated] = await conn.tx([
    {
      text: `UPDATE interviews SET status = $2, cancel_reason = $3, updated_at = now() WHERE id = $1 AND status = 'scheduled' RETURNING id`,
      params: [id, status, reason.slice(0, 300)],
    },
    event(before.application_id, userId, `${before.round} ${label}${reason ? `: ${reason}` : ""}`, { interview_id: id, action: status }),
    ...(status === "completed" ? advance(before.application_id, userId, "interview_completed", ["interview_scheduled"]) : []),
  ]);
  return updated.length > 0;
}

export function parseFeedback(form: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const rating = Number(str(form.rating, 1));
  const recommendation = str(form.recommendation, 20) as Recommendation;
  const notes = str(form.notes, 4000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "Choose a rating from 1 to 5.";
  if (!(RECOMMENDATIONS as readonly string[]).includes(recommendation)) errors.recommendation = "Choose a recommendation.";
  return { data: { rating, recommendation, notes }, errors };
}

/** One feedback entry per interviewer; saving again updates it. Feedback also completes a scheduled interview. */
export async function saveFeedback(id: string, userId: string, input: { rating: number; recommendation: Recommendation; notes: string }) {
  const before = await getInterview(id);
  if (!before || before.status === "cancelled") return false;
  const conn = await db();
  await conn.tx([
    {
      text: `INSERT INTO interview_feedback (interview_id, user_id, rating, recommendation, notes) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (interview_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, recommendation = EXCLUDED.recommendation, notes = EXCLUDED.notes, updated_at = now()`,
      params: [id, userId, input.rating, input.recommendation, input.notes],
    },
    event(before.application_id, userId, `Feedback on ${before.round}: ${input.rating}/5, ${RECOMMENDATION_LABELS[input.recommendation]}`, {
      interview_id: id,
      action: "feedback",
      rating: input.rating,
      recommendation: input.recommendation,
    }),
    ...(before.status === "scheduled"
      ? [
          { text: `UPDATE interviews SET status = 'completed', updated_at = now() WHERE id = $1 AND status = 'scheduled'`, params: [id] },
          ...advance(before.application_id, userId, "interview_completed", ["interview_scheduled"]),
        ]
      : []),
  ]);
  return true;
}

/** Interviews starting in the next `hours` that have not had a reminder yet. */
export async function interviewsNeedingReminder(hours = 24) {
  const conn = await db();
  return conn.query<Interview>(
    `${SELECT} WHERE i.status = 'scheduled' AND i.reminded_at IS NULL AND i.scheduled_at > now() AND i.scheduled_at <= now() + ($1::int * interval '1 hour') ORDER BY i.scheduled_at`,
    [hours],
  );
}

/**
 * Claims an interview for its reminder. Only one caller can claim it, so two
 * overlapping cron runs never email the same panel twice.
 */
export async function claimReminder(id: string) {
  const conn = await db();
  const rows = await conn.query<{ id: string }>(
    `UPDATE interviews SET reminded_at = now() WHERE id = $1 AND reminded_at IS NULL AND status = 'scheduled' RETURNING id`,
    [id],
  );
  return rows.length === 1;
}

/** Gives a claim back when the email could not be sent, so the next run retries it. */
export async function releaseReminder(id: string) {
  const conn = await db();
  await conn.query(`UPDATE interviews SET reminded_at = NULL WHERE id = $1`, [id]);
}

/** Active admins who can sit on an interview panel. */
export async function interviewerOptions() {
  const conn = await db();
  return conn.query<{ id: string; name: string; role: string }>(`SELECT id, name, role FROM admin_users WHERE active AND role <> 'viewer' ORDER BY name`);
}

/* ------------------------------------------------------------------ */
/* Calendar file                                                        */
/* ------------------------------------------------------------------ */

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Lines over 75 octets are folded, as the iCalendar format requires. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 73) {
    let cut = 73;
    while (Buffer.byteLength(rest.slice(0, cut)) > 73) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
};

/** An .ics invite for the interview panel. No client name is included. */
export function interviewIcs(i: Interview, origin: string) {
  const start = new Date(i.scheduled_at);
  const end = new Date(start.getTime() + i.duration_minutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VMR Cloud Solutions//Recruitment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:interview-${i.id}@vmrcloudsolutions.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`${i.round}: ${i.candidate_name} (${i.opening_title ?? i.position})`)}`,
    `LOCATION:${icsText(i.location || INTERVIEW_MODE_LABELS[i.mode])}`,
    `DESCRIPTION:${icsText(
      [
        `Candidate: ${i.candidate_name}`,
        `Role: ${i.opening_title ?? i.position}`,
        `How: ${INTERVIEW_MODE_LABELS[i.mode]}${i.location ? ` – ${i.location}` : ""}`,
        `Panel: ${i.panel.map((p) => p.name).join(", ")}`,
        i.notes ? `Notes: ${i.notes}` : "",
        `Details: ${origin}/admin/interviews/${i.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )}`,
    `STATUS:${i.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
