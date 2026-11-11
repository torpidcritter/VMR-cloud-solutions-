import "server-only";
import nodemailer from "nodemailer";

/**
 * Sends form submissions by email.
 *
 * Configure with environment variables (see .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM
 *   CONTACT_TO (default rajesh.v@), CAREERS_TO (default hr@)
 * For local testing only, MAIL_TRANSPORT=log prints messages instead of sending.
 */

export class MailNotConfiguredError extends Error {}

type Mail = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

export async function sendMail(mail: Mail) {
  if (process.env.MAIL_TRANSPORT === "log") {
    console.info("[mail:log]", { ...mail, attachments: mail.attachments?.map((a) => `${a.filename} (${a.content.length} bytes)`) });
    return;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new MailNotConfiguredError("SMTP is not configured");

  const port = Number(SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from: MAIL_FROM || `VMR Cloud Website <${SMTP_USER}>`,
    ...mail,
  });
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function tableHtml(title: string, rows: [string, string][]) {
  return `<div style="font-family:Arial,sans-serif;color:#0f1b33">
<h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h2>
<table cellpadding="8" style="border-collapse:collapse;font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="border:1px solid #e3e8f0;background:#f5f7fb;font-weight:600;vertical-align:top">${escapeHtml(k)}</td><td style="border:1px solid #e3e8f0;white-space:pre-wrap">${escapeHtml(v || "—")}</td></tr>`,
  )
  .join("\n")}
</table></div>`;
}
