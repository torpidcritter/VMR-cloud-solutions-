import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { claimReminder, interviewIcs, interviewsNeedingReminder, releaseReminder } from "@/lib/data/interviews";
import { INTERVIEW_MODE_LABELS } from "@/lib/data/constants";
import { escapeHtml, isMailConfigured, sendMail, tableHtml } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a secret the route stays closed. */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";

/** Emails each interview panel once, about a day before. Safe to run as often as you like. */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!isMailConfigured()) return NextResponse.json({ sent: 0, skipped: "Email is not configured" });

  const origin = process.env.ADMIN_ORIGIN?.replace(/\/$/, "") || new URL(req.url).origin;
  const due = await interviewsNeedingReminder(24);
  let sent = 0;
  const failed: string[] = [];
  for (const i of due) {
    const to = i.panel.map((p) => p.email).filter(Boolean);
    if (!to.length || !(await claimReminder(i.id))) continue;
    const role = i.opening_title ?? i.position;
    try {
      await sendMail({
        to: to.join(", "),
        subject: `Reminder: ${i.round} with ${i.candidate_name}, ${when(i.scheduled_at)}`,
        text: [
          `${i.round} with ${i.candidate_name} for ${role}`,
          `When: ${when(i.scheduled_at)} (${i.duration_minutes} minutes)`,
          `How: ${INTERVIEW_MODE_LABELS[i.mode]}${i.location ? ` – ${i.location}` : ""}`,
          `Panel: ${i.panel.map((p) => p.name).join(", ")}`,
          `Details and feedback: ${origin}/admin/interviews/${i.id}`,
        ].join("\n"),
        html:
          tableHtml(`Reminder: ${i.round} with ${i.candidate_name}`, [
            ["Role", role],
            ["When", `${when(i.scheduled_at)} (${i.duration_minutes} minutes)`],
            ["How", `${INTERVIEW_MODE_LABELS[i.mode]}${i.location ? ` – ${i.location}` : ""}`],
            ["Panel", i.panel.map((p) => p.name).join(", ")],
          ]) + `<p style="font-family:Arial,sans-serif"><a href="${escapeHtml(`${origin}/admin/interviews/${i.id}`)}">Open the interview and leave feedback</a></p>`,
        attachments: [{ filename: "interview.ics", content: Buffer.from(interviewIcs(i, origin)), contentType: "text/calendar" }],
      });
      sent++;
    } catch (err) {
      console.error("[cron:reminders] could not send", i.id, err);
      await releaseReminder(i.id);
      failed.push(i.id);
    }
  }
  return NextResponse.json({ due: due.length, sent, failed: failed.length });
}
