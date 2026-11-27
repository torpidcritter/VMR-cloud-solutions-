"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { addApplicationNote, deleteApplication, getApplication, setApplicationStatus } from "@/lib/data/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, canMoveApplication, type ApplicationStatus } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import { deleteStoredFile, deleteSubmissionRecord } from "@/lib/cv-storage";
import type { ActionState } from "@/components/admin/forms";

export async function setApplicationStatusAction(form: FormData) {
  const me = await assertAdmin("applications.update");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as ApplicationStatus;
  if (!APPLICATION_STATUSES.includes(status)) return;
  const app = await getApplication(id);
  if (!app) return;
  const superAdmin = me.role === "super_admin";
  if (app.status !== status && !canMoveApplication(app.status, status, superAdmin)) redirect(`/admin/applications/${id}?refused=1`);
  if (await setApplicationStatus(id, status, me.id, { superAdmin })) {
    await logActivity(me.id, "status", "application", id, `#${app.number} ${app.full_name}: ${APPLICATION_STATUS_LABELS[app.status]} → ${APPLICATION_STATUS_LABELS[status]}`);
  }
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
}

export async function addNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("applications.update");
  const id = String(form.get("id") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Write a note first." } };
  const app = await getApplication(id);
  if (!app) return { error: "This application no longer exists." };
  await addApplicationNote(id, body, me.id);
  await logActivity(me.id, "note", "application", id, `Added a note to #${app.number} ${app.full_name}`);
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}

export async function deleteApplicationAction(form: FormData) {
  const me = await assertAdmin("applications.delete");
  const id = String(form.get("id") ?? "");
  const app = await getApplication(id);
  if (!app) redirect("/admin/applications");
  // A hire is a business record (placements, targets, invoices); it is kept.
  if (app.status === "hired") redirect(`/admin/applications/${id}?nodelete=1`);
  const resume = await deleteApplication(id);
  if (resume) {
    try {
      await deleteStoredFile(resume);
      // Upload CV keeps the form answers next to the CV; they go too.
      await deleteSubmissionRecord(resume);
    } catch (err) {
      console.error("[admin] resume delete failed", err instanceof Error ? err.message : err);
    }
  }
  await logActivity(me.id, "delete", "application", id, `Deleted application #${app.number} (${app.position})`);
  redirect("/admin/applications?deleted=1");
}
