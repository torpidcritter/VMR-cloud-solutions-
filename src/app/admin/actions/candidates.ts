"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { addCandidateNote, getCandidate, mergeCandidates, parseCandidate, setCandidateFields, updateCandidate } from "@/lib/data/candidates";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const UUID = /^[0-9a-f-]{36}$/i;
const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function saveCandidateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("candidates.edit");
  const id = s(form.get("id"), 40);
  if (!UUID.test(id)) return { error: "This candidate no longer exists." };
  const raw = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
  const { data, errors } = parseCandidate(raw);
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const res = await updateCandidate(id, data, me.id);
  if (!res) return { error: "This candidate no longer exists." };
  if (res.changed.length) await logActivity(me.id, "update", "candidate", id, `Updated ${data.full_name}: ${res.changed.join(", ")}`);
  revalidatePath(`/admin/candidates/${id}`);
  return { ok: true, message: res.changed.length ? "Profile saved." : "No changes to save." };
}

/** Header quick actions: priority, owner, follow-up date, "contacted today". */
export async function quickCandidateAction(form: FormData) {
  const me = await assertAdmin("candidates.edit");
  const id = s(form.get("id"), 40);
  const field = s(form.get("field"), 20);
  const value = s(form.get("value"), 40);
  const changes =
    field === "priority"
      ? { priority: value }
      : field === "owner"
        ? { owner_id: value || null }
        : field === "followup"
          ? { follow_up_on: value || null }
          : field === "contacted"
            ? { last_contacted: true }
            : null;
  if (!changes) return;
  if (await setCandidateFields(id, changes, me.id)) {
    const c = await getCandidate(id);
    await logActivity(me.id, "update", "candidate", id, `${c?.full_name ?? "Candidate"}: ${field === "contacted" ? "marked as contacted" : `${field} set to ${value || "none"}`}`);
  }
  revalidatePath(`/admin/candidates/${id}`);
}

export async function candidateNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("candidates.edit");
  const id = s(form.get("id"), 40);
  const body = s(form.get("body"), 4000);
  if (!body) return { errors: { body: "Write a note first." } };
  if (!UUID.test(id)) return { error: "This candidate no longer exists." };
  await addCandidateNote(id, body, me.id, s(form.get("applicationId"), 40) || null);
  await logActivity(me.id, "note", "candidate", id, "Added a note to a candidate profile");
  revalidatePath(`/admin/candidates/${id}`);
  return { ok: true, message: "Note added." };
}

export async function mergeCandidatesAction(form: FormData) {
  const me = await assertAdmin("candidates.merge");
  const keep = s(form.get("keep"), 40);
  const drop = s(form.get("drop"), 40);
  const [a, b] = await Promise.all([getCandidate(keep), getCandidate(drop)]);
  if (!a || !b) redirect(`/admin/candidates/${keep}`);
  await mergeCandidates(keep, drop, me.id);
  await logActivity(me.id, "merge", "candidate", keep, `Merged ${b.full_name} (${b.email}) into ${a.full_name} (${a.email})`);
  redirect(`/admin/candidates/${keep}?merged=1`);
}
