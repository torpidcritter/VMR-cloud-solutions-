import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { firstName, type MergeValues } from "@/lib/email-templates";
import { INTERVIEW_MODE_LABELS, type InterviewMode } from "./constants";

/**
 * Email templates and the emails sent to candidates from the admin panel.
 * Mail goes out through the site's existing SMTP settings (src/lib/mailer.ts).
 */

const isUuid = (v?: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type EmailTemplate = { id: string; name: string; subject: string; body: string; active: boolean; updated_by_name: string | null; updated_at: string };

export function parseTemplate(form: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const data = {
    name: str(form.name, 80),
    subject: str(form.subject, 200).replace(/[\r\n\t]+/g, " "),
    body: (typeof form.body === "string" ? form.body : "").replace(/\r\n?/g, "\n").trim().slice(0, 8000),
    active: form.active !== "off",
  };
  if (!data.name) errors.name = "Name the template.";
  if (!data.subject) errors.subject = "Enter a subject line.";
  if (!data.body) errors.body = "Write the message.";
  return { data, errors };
}

export async function listTemplates({ activeOnly = false } = {}) {
  const conn = await db();
  return conn.query<EmailTemplate>(
    `SELECT t.id, t.name, t.subject, t.body, t.active, u.name AS updated_by_name, t.updated_at
       FROM email_templates t LEFT JOIN admin_users u ON u.id = t.updated_by ${activeOnly ? "WHERE t.active" : ""} ORDER BY lower(t.name)`,
  );
}

export async function getTemplate(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<EmailTemplate>(
    `SELECT t.id, t.name, t.subject, t.body, t.active, u.name AS updated_by_name, t.updated_at FROM email_templates t LEFT JOIN admin_users u ON u.id = t.updated_by WHERE t.id = $1`,
    [id],
  );
  return row ?? null;
}

export async function saveTemplate(id: string | null, t: { name: string; subject: string; body: string; active: boolean }, userId: string): Promise<string | "duplicate" | null> {
  const conn = await db();
  const [clash] = await conn.query<{ id: string }>(`SELECT id FROM email_templates WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)`, [t.name, isUuid(id) ? id : null]);
  if (clash) return "duplicate";
  try {
    if (id) {
      if (!isUuid(id)) return null;
      const [row] = await conn.query<{ id: string }>(
        `UPDATE email_templates SET name=$2, subject=$3, body=$4, active=$5, updated_by=$6, updated_at=now() WHERE id=$1 RETURNING id`,
        [id, t.name, t.subject, t.body, t.active, userId],
      );
      return row?.id ?? null;
    }
    const [row] = await conn.query<{ id: string }>(`INSERT INTO email_templates (name, subject, body, active, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [
      t.name,
      t.subject,
      t.body,
      t.active,
      userId,
    ]);
    return row.id;
  } catch (err) {
    if (/email_templates_name|unique|duplicate key/i.test(String(err))) return "duplicate";
    throw err;
  }
}

/** Sent emails keep their own copy of the text, so deleting a template loses nothing. */
export async function deleteTemplate(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ name: string }>(`DELETE FROM email_templates WHERE id = $1 RETURNING name`, [id]);
  return row?.name ?? null;
}

/* ------------------------------------------------------------------ */
/* Composing                                                            */
/* ------------------------------------------------------------------ */

export type ComposeApplication = { id: string; label: string; values: MergeValues };

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Merge values for each of a candidate's applications. The role is the
 * opening's public title; the client's name is deliberately not available.
 */
export async function composeContext(candidateId: string, recruiterName: string) {
  if (!isUuid(candidateId)) return null;
  const conn = await db();
  const [c] = await conn.query<{ full_name: string; email: string }>(`SELECT full_name, email FROM candidates WHERE id = $1`, [candidateId]);
  if (!c) return null;
  const apps = await conn.query<{ id: string; number: string; position: string; round: string | null; scheduled_at: string | null; mode: InterviewMode | null; location: string | null }>(
    `SELECT a.id, a.number::text, COALESCE(o.title, a.position) AS position, i.round, i.scheduled_at, i.mode, i.location
       FROM applications a LEFT JOIN job_openings o ON o.id = a.opening_id
       LEFT JOIN LATERAL (
         SELECT round, scheduled_at, mode, location FROM interviews WHERE application_id = a.id AND status = 'scheduled' AND scheduled_at > now()
          ORDER BY scheduled_at LIMIT 1
       ) i ON true
      WHERE a.candidate_id = $1 ORDER BY a.submitted_at DESC`,
    [candidateId],
  );
  const base: MergeValues = { candidate_first_name: firstName(c.full_name), candidate_name: c.full_name, recruiter_name: recruiterName };
  const applications: ComposeApplication[] = apps.map((a) => ({
    id: a.id,
    label: `#${a.number} ${a.position}`.slice(0, 90),
    values: {
      ...base,
      position: a.position,
      ...(a.scheduled_at
        ? {
            interview_round: a.round ?? "",
            interview_date: istDate(a.scheduled_at),
            interview_time: istTime(a.scheduled_at),
            interview_mode: a.mode ? INTERVIEW_MODE_LABELS[a.mode] : "",
            interview_location: a.location ?? "",
          }
        : {}),
    },
  }));
  return { to: c.email, base, applications };
}

/* ------------------------------------------------------------------ */
/* The record of what was sent                                          */
/* ------------------------------------------------------------------ */

export type EmailMessage = {
  id: string;
  application_id: string | null;
  application_number: string | null;
  template_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  status: "sending" | "sent" | "failed";
  sent_by_name: string | null;
  created_at: string;
};

/** Emails this person sent in the last hour, for the sending limit. */
export async function recentSends(userId: string) {
  const conn = await db();
  const [{ n }] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM email_messages WHERE sent_by = $1 AND created_at > now() - interval '1 hour'`, [userId]);
  return Number(n);
}

/**
 * Records an email after the attempt. A sent one also goes on the timeline and
 * updates "last contacted", all in one transaction.
 */
export async function recordEmail(m: {
  candidateId: string;
  applicationId: string | null;
  templateId: string | null;
  to: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  error?: string;
  userId: string;
}) {
  const conn = await db();
  const id = randomUUID();
  await conn.tx([
    {
      text: `INSERT INTO email_messages (id, candidate_id, application_id, template_id, to_email, subject, body, status, error, sent_by)
             VALUES ($1, $2, $3, (SELECT id FROM email_templates WHERE id = $4::uuid), $5, $6, $7, $8, $9, $10)`,
      params: [id, m.candidateId, m.applicationId, m.templateId, m.to, m.subject, m.body, m.status, (m.error ?? "").slice(0, 500), m.userId],
    },
    ...(m.status === "sent"
      ? [
          {
            text: `INSERT INTO application_events (candidate_id, application_id, user_id, kind, body, details) VALUES ($1, $2, $3, 'email', $4, $5::jsonb)`,
            params: [m.candidateId, m.applicationId, m.userId, `Emailed: ${m.subject}`.slice(0, 300), JSON.stringify({ email_id: id })],
          },
          { text: `UPDATE candidates SET last_contacted_at = now(), updated_at = now() WHERE id = $1`, params: [m.candidateId] },
        ]
      : []),
  ]);
  return id;
}

/**
 * One send per compose form (M-18). The message is recorded as "sending"
 * under the form's key before the mail server is called; a second request
 * with the same key (a double click, a retry after a slow response) finds
 * the claim and sends nothing. Returns null when the key was already used.
 */
export async function claimEmail(m: { candidateId: string; applicationId: string | null; templateId: string | null; to: string; subject: string; body: string; userId: string; key: string }) {
  const conn = await db();
  const [row] = await conn.query<{ id: string }>(
    `INSERT INTO email_messages (candidate_id, application_id, template_id, to_email, subject, body, status, sent_by, send_key)
     VALUES ($1, $2, (SELECT id FROM email_templates WHERE id = $3::uuid), $4, $5, $6, 'sending', $7, $8)
     ON CONFLICT (send_key) DO NOTHING RETURNING id`,
    [m.candidateId, m.applicationId, m.templateId, m.to, m.subject, m.body, m.userId, m.key],
  );
  return row?.id ?? null;
}

/** Marks a claimed message sent (with its timeline entry) or failed; a failed one frees its key so the same form can try again. */
export async function finishEmail(id: string, m: { candidateId: string; applicationId: string | null; subject: string; userId: string }, outcome: { status: "sent" } | { status: "failed"; error: string }) {
  const conn = await db();
  if (outcome.status === "failed") {
    await conn.query(`UPDATE email_messages SET status = 'failed', error = $2, send_key = NULL WHERE id = $1`, [id, outcome.error.slice(0, 500)]);
    return;
  }
  await conn.tx([
    { text: `UPDATE email_messages SET status = 'sent' WHERE id = $1`, params: [id] },
    {
      text: `INSERT INTO application_events (candidate_id, application_id, user_id, kind, body, details) VALUES ($1, $2, $3, 'email', $4, $5::jsonb)`,
      params: [m.candidateId, m.applicationId, m.userId, `Emailed: ${m.subject}`.slice(0, 300), JSON.stringify({ email_id: id })],
    },
    { text: `UPDATE candidates SET last_contacted_at = now(), updated_at = now() WHERE id = $1`, params: [m.candidateId] },
  ]);
}

export async function listEmails(candidateId: string, limit = 50) {
  if (!isUuid(candidateId)) return [];
  const conn = await db();
  return conn.query<EmailMessage>(
    `SELECT m.id, m.application_id, a.number::text AS application_number, t.name AS template_name, m.to_email, m.subject, m.body, m.status, u.name AS sent_by_name, m.created_at
       FROM email_messages m LEFT JOIN applications a ON a.id = m.application_id LEFT JOIN email_templates t ON t.id = m.template_id
       LEFT JOIN admin_users u ON u.id = m.sent_by
      WHERE m.candidate_id = $1 ORDER BY m.created_at DESC LIMIT $2`,
    [candidateId, limit],
  );
}
