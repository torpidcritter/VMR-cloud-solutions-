"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/session";
import { getCandidate } from "@/lib/data/candidates";
import { deleteTemplate, parseTemplate, recentSends, recordEmail, saveTemplate } from "@/lib/data/email";
import { bodyToHtml, cleanSubject, unfilledFields } from "@/lib/email-templates";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Per person, per hour. Generous for real work, small enough to stop a runaway script. */
const SEND_LIMIT = 40;

/**
 * Sends one email to a candidate. The address always comes from the profile,
 * never from the form, so this can only ever write to the candidate.
 */
export async function sendCandidateEmailAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("email.send");
  const candidateId = s(form.get("candidateId"), 40);
  const c = await getCandidate(candidateId);
  if (!c) return { error: "This candidate no longer exists." };
  const applicationId = s(form.get("applicationId"), 40);
  if (applicationId && !c.applications.some((a) => a.id === applicationId)) return { error: "That application isn't on this profile." };
  const templateId = UUID.test(s(form.get("templateId"), 40)) ? s(form.get("templateId"), 40) : null;

  const subject = cleanSubject(s(form.get("subject"), 400));
  const body = (typeof form.get("body") === "string" ? String(form.get("body")) : "").replace(/\r\n?/g, "\n").trim();
  const errors: Record<string, string> = {};
  if (!subject) errors.subject = "Enter a subject line.";
  else if (subject.length > 200) errors.subject = "Keep the subject under 200 characters.";
  if (!body) errors.body = "Write the message.";
  else if (body.length > 8000) errors.body = "Keep the message under 8,000 characters.";
  const missing = unfilledFields(`${subject}\n${body}`);
  if (missing.length) errors.body = `Fill in or remove ${missing.map((m) => `{{${m}}}`).join(", ")} before sending.`;
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };

  if (!EMAIL_RE.test(c.email)) return { error: "This profile has no valid email address." };
  if (!isMailConfigured()) return { error: "Email isn't set up on this site yet, so nothing was sent. Ask a Super Admin to add the SMTP settings." };
  if ((await recentSends(me.id)) >= SEND_LIMIT) return { error: `You've sent ${SEND_LIMIT} emails in the last hour. Please wait a little before sending more.` };

  const base = { candidateId: c.id, applicationId: applicationId || null, templateId, to: c.email, subject, body, userId: me.id };
  try {
    await sendMail({ to: c.email, replyTo: me.email, subject, text: body, html: bodyToHtml(body) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[email] send to candidate failed", detail);
    await recordEmail({ ...base, status: "failed", error: detail });
    revalidatePath(`/admin/candidates/${c.id}`);
    return { error: "The mail server didn't accept the email, so it wasn't sent. Your text is kept below; try again in a few minutes." };
  }
  await recordEmail({ ...base, status: "sent" });
  await logActivity(me.id, "email", "candidate", c.id, `Emailed ${c.full_name}: ${subject}`);
  revalidatePath(`/admin/candidates/${c.id}`);
  if (applicationId) revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true, message: `Email sent to ${c.email}.` };
}

export async function saveTemplateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("settings.manage");
  const id = s(form.get("id"), 40) || null;
  const raw = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
  const { data, errors } = parseTemplate(raw);
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const res = await saveTemplate(id, data, me.id);
  if (res === "duplicate") return { errors: { name: "Another template has this name." }, error: "Another template has this name." };
  if (!res) return { error: "This template no longer exists." };
  await logActivity(me.id, id ? "update" : "create", "email_template", res, `${id ? "Updated" : "Added"} email template "${data.name}"`);
  revalidatePath("/admin/settings/email-templates");
  return { ok: true, message: id ? "Template saved." : "Template added." };
}

export async function deleteTemplateAction(form: FormData) {
  const me = await assertAdmin("settings.manage");
  const id = s(form.get("id"), 40);
  const name = await deleteTemplate(id);
  if (name) await logActivity(me.id, "delete", "email_template", id, `Deleted email template "${name}"`);
  revalidatePath("/admin/settings/email-templates");
}
