"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createTask, deleteTask, getTask, parseTask, setTaskDone, updateTask, type Task } from "@/lib/data/tasks";
import { notify } from "@/lib/data/notifications";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fields = (form: FormData) => Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));

function refresh(t?: Pick<Task, "candidate_id" | "client_id" | "opening_id"> | null) {
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/my-work");
  if (t?.candidate_id) revalidatePath(`/admin/candidates/${t.candidate_id}`);
  if (t?.client_id) revalidatePath(`/admin/clients/${t.client_id}`);
  if (t?.opening_id) revalidatePath(`/admin/openings/${t.opening_id}`);
}

/**
 * Anyone can keep their own tasks. Giving a task to someone else, or changing
 * someone else's, needs tasks.manage.
 */
export async function createTaskAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin();
  const { data, errors } = parseTask(fields(form), me.id);
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  if (data.owner_id !== me.id && !can(me.role, "tasks.manage")) return { error: "Your role can only add tasks for yourself." };
  // Client links are only for people who can see clients.
  if (data.client_id && !can(me.role, "clients.view")) data.client_id = null;
  const id = await createTask(data, me.id);
  if (!id) return { errors: { owner_id: "Choose an active team member." }, error: "That person can't be given tasks." };
  const t = await getTask(id);
  await logActivity(me.id, "create", "task", id, `Added task "${data.title}"${t && t.owner_id !== me.id ? ` for ${t.owner_name}` : ""}`);
  await notify([data.owner_id], me.id, "task", `${me.name} gave you a task: ${data.title}${data.due_on ? ` (due ${data.due_on})` : ""}`, "/admin/tasks");
  refresh(t);
  return { ok: true, message: "Task added." };
}

async function mayChange(id: string) {
  const me = await assertAdmin();
  const t = await getTask(id);
  if (!t) return { me, t: null, allowed: false };
  const allowed = t.owner_id === me.id || t.created_by === me.id || can(me.role, "tasks.manage");
  return { me, t, allowed };
}

export async function toggleTaskAction(form: FormData) {
  const { me, t, allowed } = await mayChange(s(form.get("id"), 40));
  if (!t || !allowed) return;
  const done = s(form.get("done"), 5) === "1";
  if (await setTaskDone(t.id, done, me.id)) {
    await logActivity(me.id, "update", "task", t.id, `${done ? "Completed" : "Reopened"} task "${t.title}"`);
    if (done && t.created_by && t.created_by !== me.id) await notify([t.created_by], me.id, "task", `${me.name} finished the task: ${t.title}`, "/admin/tasks?status=done");
  }
  refresh(t);
}

export async function updateTaskAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { me, t, allowed } = await mayChange(s(form.get("id"), 40));
  if (!t) return { error: "This task no longer exists." };
  if (!allowed) return { error: "Only the task's owner or creator can change it." };
  const { data, errors } = parseTask(fields(form), t.owner_id);
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  if (data.owner_id !== t.owner_id && !can(me.role, "tasks.manage")) return { error: "Your role can't hand tasks to other people." };
  await updateTask(t.id, data);
  if (data.owner_id !== t.owner_id) await notify([data.owner_id], me.id, "task", `${me.name} gave you a task: ${data.title}`, "/admin/tasks");
  await logActivity(me.id, "update", "task", t.id, `Updated task "${data.title}"`);
  refresh(t);
  return { ok: true, message: "Task saved." };
}

export async function deleteTaskAction(form: FormData) {
  const { me, t, allowed } = await mayChange(s(form.get("id"), 40));
  if (!t || !allowed) return;
  const title = await deleteTask(t.id);
  if (title) await logActivity(me.id, "delete", "task", t.id, `Deleted task "${title}"`);
  refresh(t);
}
