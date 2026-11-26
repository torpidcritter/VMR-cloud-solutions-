"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError } from "@/lib/auth/session";
import { assignApplication, getApplication, recruiterOptions, setApplicationStatus } from "@/lib/data/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";

type Result = { ok: true } | { ok: false; error: string };

/** Moves one application to a stage. Called by the Kanban board (drag and drop or the Move menu). */
export async function moveApplicationAction(id: string, status: string): Promise<Result> {
  let me;
  try {
    me = await assertAdmin("applications.update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown stage." };
  const app = await getApplication(id);
  if (!app) return { ok: false, error: "This application no longer exists." };
  if (app.status === status) return { ok: true };
  const moved = await setApplicationStatus(id, status as ApplicationStatus, me.id);
  if (!moved) return { ok: false, error: "Someone else moved this card a moment ago. The board has been refreshed." };
  await logActivity(me.id, "status", "application", id, `#${app.number} ${app.full_name}: ${APPLICATION_STATUS_LABELS[app.status]} → ${APPLICATION_STATUS_LABELS[status as ApplicationStatus]}`);
  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}

export async function assignApplicationAction(form: FormData) {
  const me = await assertAdmin("applications.update");
  const id = String(form.get("id") ?? "");
  const to = String(form.get("assignee") ?? "") || null;
  const app = await getApplication(id);
  if (!app) return;
  // Only active Super Admins and Recruiters can own an application.
  if (to && !(await recruiterOptions()).some((r) => r.id === to)) return;
  if (await assignApplication(id, to, me.id)) {
    await logActivity(me.id, "assign", "application", id, `#${app.number} ${app.full_name} ${to ? "assigned" : "unassigned"}`);
  }
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/pipeline");
}
