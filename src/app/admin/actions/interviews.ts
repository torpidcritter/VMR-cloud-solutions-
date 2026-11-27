"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getApplication } from "@/lib/data/applications";
import {
  findConflicts,
  getInterview,
  parseFeedback,
  parseInterview,
  rescheduleInterview,
  saveFeedback,
  scheduleInterview,
  setInterviewStatus,
} from "@/lib/data/interviews";
import { INTERVIEW_STATUS_LABELS, type InterviewStatus } from "@/lib/data/constants";
import { setTarget } from "@/lib/data/workspace";
import { logActivity } from "@/lib/data/activity";
import { notify } from "@/lib/data/notifications";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fields = (form: FormData) => Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
const panelOf = (form: FormData) => form.getAll("panel").filter((v): v is string => typeof v === "string");

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function refresh(applicationId: string, candidateId?: string, interviewId?: string) {
  revalidatePath(`/admin/applications/${applicationId}`);
  if (candidateId) revalidatePath(`/admin/candidates/${candidateId}`);
  if (interviewId) revalidatePath(`/admin/interviews/${interviewId}`);
  revalidatePath("/admin/interviews");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/my-work");
}

/** Schedule (no id) or reschedule (id). Overlaps are shown first and need a second click to override. */
export async function saveInterviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("interviews.manage");
  const interviewId = s(form.get("interviewId"), 40);
  const before = interviewId ? await getInterview(interviewId) : null;
  if (interviewId && !before) return { error: "This interview no longer exists." };
  if (before && before.status !== "scheduled") return { error: "Only a scheduled interview can be changed." };
  const applicationId = before?.application_id ?? s(form.get("applicationId"), 40);
  const app = await getApplication(applicationId);
  if (!app) return { error: "This application no longer exists." };

  const { data, errors } = parseInterview(fields(form), panelOf(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };

  if (s(form.get("allowConflicts"), 3) !== "yes") {
    const clashes = await findConflicts(data, applicationId, interviewId || undefined);
    if (clashes.length) {
      const list = clashes.map((c) => `${c.round} with ${c.candidate_name} at ${when(c.scheduled_at)}${c.who ? ` (${c.who})` : ""}`).join("; ");
      return { error: `This overlaps another interview: ${list}. Choose another time, or tick "Schedule anyway".`, data: { conflict: "1" } };
    }
  }

  if (before) {
    await rescheduleInterview(before.id, data, me.id);
    await logActivity(me.id, "update", "interview", before.id, `${data.round} for ${app.full_name} set for ${when(data.scheduledAt)}`);
    // Everyone on the panel hears about a new time; people just added hear they're on it.
    const moved = new Date(before.scheduled_at).getTime() !== new Date(data.scheduledAt).getTime();
    const added = data.panel.filter((p) => !before.panel.some((x) => x.id === p));
    await notify(added, me.id, "interview", `You're on the panel: ${data.round} with ${app.full_name}, ${when(data.scheduledAt)}`, `/admin/interviews/${before.id}`);
    if (moved) await notify(data.panel.filter((p) => !added.includes(p)), me.id, "interview", `Moved: ${data.round} with ${app.full_name} is now ${when(data.scheduledAt)}`, `/admin/interviews/${before.id}`);
    refresh(applicationId, app.candidate_id, before.id);
    return { ok: true, message: "Interview updated." };
  }
  const id = await scheduleInterview(applicationId, data, me.id);
  if (!id) return { error: "This application no longer exists." };
  await logActivity(me.id, "create", "interview", id, `Scheduled ${data.round} for ${app.full_name} on ${when(data.scheduledAt)}`);
  await notify(data.panel, me.id, "interview", `You're on the panel: ${data.round} with ${app.full_name}, ${when(data.scheduledAt)}`, `/admin/interviews/${id}`);
  refresh(applicationId, app.candidate_id, id);
  return { ok: true, message: "Interview scheduled." };
}

export async function interviewStatusAction(form: FormData) {
  const me = await assertAdmin("interviews.manage");
  const id = s(form.get("id"), 40);
  const status = s(form.get("status"), 20) as InterviewStatus;
  if (!["completed", "cancelled", "no_show"].includes(status)) return;
  const i = await getInterview(id);
  if (!i) return;
  if (await setInterviewStatus(id, status as Exclude<InterviewStatus, "scheduled">, me.id, s(form.get("reason"), 300))) {
    await logActivity(me.id, "status", "interview", id, `${i.round} for ${i.candidate_name}: ${INTERVIEW_STATUS_LABELS[status]}`);
  }
  refresh(i.application_id, i.candidate_id, id);
}

/** Interviewers on the panel may always leave feedback; so may anyone who manages interviews. */
export async function feedbackAction(_: ActionState, form: FormData): Promise<ActionState> {
  let me;
  try {
    me = await assertAdmin();
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
  const id = s(form.get("id"), 40);
  const i = await getInterview(id);
  if (!i) return { error: "This interview no longer exists." };
  if (!i.panel.some((p) => p.id === me.id) && !can(me.role, "interviews.manage")) return { error: "Only the interview panel can leave feedback." };
  if (i.status === "cancelled") return { error: "This interview was cancelled." };
  const { data, errors } = parseFeedback(fields(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  await saveFeedback(id, me.id, data);
  await logActivity(me.id, "update", "interview", id, `Feedback on ${i.round} for ${i.candidate_name}: ${data.rating}/5`);
  refresh(i.application_id, i.candidate_id, id);
  return { ok: true, message: "Feedback saved." };
}

export async function setTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("users.manage");
  const userId = s(form.get("userId"), 40);
  const raw = s(form.get("placements"), 4);
  const n = raw === "" ? null : Number(raw);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: "This user no longer exists." };
  if (n !== null && (!Number.isInteger(n) || n < 0 || n > 999)) return { errors: { placements: "Enter a whole number from 0 to 999." }, error: "Please fix the highlighted fields." };
  await setTarget(userId, n);
  await logActivity(me.id, "update", "user", userId, n === null ? "Cleared this month's placement target" : `Set this month's placement target to ${n}`);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/my-work");
  return { ok: true, message: n === null ? "Target cleared." : "Target saved." };
}
