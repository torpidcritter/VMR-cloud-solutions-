import "server-only";
import { db } from "@/lib/db/client";
import { readStoredFile } from "@/lib/cv-storage";
import { sendMail } from "@/lib/mailer";
import { errorMessage, log } from "@/lib/log";

/**
 * Emails to the team that failed to send (a new application, a new CV) are
 * queued here instead of being lost (M-17). The daily job retries each one up
 * to MAX_ATTEMPTS times with a growing delay; each row is claimed before it is
 * sent, so two runs at once can't send it twice.
 */

export const MAX_ATTEMPTS = 6;

type Mail = { to: string; replyTo?: string; subject: string; text: string; html: string };

export async function queueMail(m: { kind: string; ref?: string; mail: Mail; attachment?: { path: string; name: string; type: string } | null; error: string }) {
  try {
    const conn = await db();
    await conn.query(
      `INSERT INTO notification_outbox (kind, ref, mail, attachment_path, attachment_name, attachment_type, attempts, last_error, next_attempt_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, 1, $7, now() + interval '30 minutes')`,
      [m.kind, m.ref ?? "", JSON.stringify(m.mail), m.attachment?.path ?? null, m.attachment?.name ?? null, m.attachment?.type ?? null, m.error.slice(0, 500)],
    );
    log("warn", "outbox.queued", { kind: m.kind, ref: m.ref });
    return true;
  } catch (err) {
    log("error", "outbox.queue_failed", { kind: m.kind, ref: m.ref, error: errorMessage(err) });
    return false;
  }
}

/** Sends what is due. Returns how many were sent, failed again, or given up on. */
export async function retryOutbox({ limit = 25 } = {}) {
  const conn = await db();
  const due = await conn.query<{ id: string; kind: string; ref: string; mail: Mail; attachment_path: string | null; attachment_name: string | null; attachment_type: string | null; attempts: number }>(
    `UPDATE notification_outbox SET claimed_at = now()
      WHERE id IN (SELECT id FROM notification_outbox
                    WHERE sent_at IS NULL AND attempts < $1 AND next_attempt_at <= now()
                      AND (claimed_at IS NULL OR claimed_at < now() - interval '15 minutes')
                    ORDER BY created_at LIMIT $2)
      RETURNING id, kind, ref, mail, attachment_path, attachment_name, attachment_type, attempts`,
    [MAX_ATTEMPTS, limit],
  );
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    try {
      const attachments = [];
      if (row.attachment_path) {
        const file = await readStoredFile(row.attachment_path);
        if (file) {
          const content = Buffer.isBuffer(file.body) ? file.body : Buffer.from(await new Response(file.body).arrayBuffer());
          attachments.push({ filename: row.attachment_name ?? "attachment", content, contentType: row.attachment_type ?? file.contentType });
        }
      }
      await sendMail({ ...row.mail, attachments });
      await conn.query(`UPDATE notification_outbox SET sent_at = now(), attempts = attempts + 1, claimed_at = NULL WHERE id = $1`, [row.id]);
      log("info", "outbox.sent", { kind: row.kind, ref: row.ref, attempts: Number(row.attempts) + 1 });
      sent++;
    } catch (err) {
      // 1, 2, 4, 8... hours between attempts.
      await conn.query(
        `UPDATE notification_outbox SET attempts = attempts + 1, last_error = $2, claimed_at = NULL,
                next_attempt_at = now() + (power(2, LEAST(attempts, 6)) * interval '1 hour') WHERE id = $1`,
        [row.id, errorMessage(err).slice(0, 500)],
      );
      const attempts = Number(row.attempts) + 1;
      log("error", attempts >= MAX_ATTEMPTS ? "outbox.gave_up" : "outbox.retry_failed", { kind: row.kind, ref: row.ref, attempts, error: errorMessage(err) });
      failed++;
    }
  }
  return { tried: due.length, sent, failed };
}

/** For Settings and the health check: what is waiting, and what was given up on. */
export async function outboxStats() {
  const conn = await db();
  const [r] = await conn.query<{ pending: number; gave_up: number }>(
    `SELECT count(*) FILTER (WHERE sent_at IS NULL AND attempts < $1)::int AS pending,
            count(*) FILTER (WHERE sent_at IS NULL AND attempts >= $1)::int AS gave_up
       FROM notification_outbox`,
    [MAX_ATTEMPTS],
  );
  return { pending: Number(r.pending), gaveUp: Number(r.gave_up) };
}
