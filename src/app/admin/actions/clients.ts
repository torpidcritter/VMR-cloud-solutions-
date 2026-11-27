"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import {
  addClientNote,
  addContact,
  addRequirement,
  createClientFromEnquiry,
  deleteClient,
  deleteContact,
  deleteRequirement,
  getClient,
  parseClient,
  parseContact,
  parseRequirement,
  saveClient,
  setPrimaryContact,
  setRequirementStatus,
} from "@/lib/data/clients";
import { notify } from "@/lib/data/notifications";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fields = (form: FormData) => Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));

function refresh(clientId?: string) {
  revalidatePath("/admin/clients");
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
}

export async function saveClientAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("clients.edit");
  const id = s(form.get("id"), 40) || null;
  const before = id ? await getClient(id) : null;
  if (id && !before) return { error: "This client no longer exists." };
  const { data, errors } = parseClient(fields(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const res = await saveClient(id, data, me.id);
  if (res === "duplicate") return { errors: { name: "A client with this name already exists." }, error: "A client with this name already exists." };
  if (!res) return { error: "This client no longer exists." };
  const managerChanged = res.id && data.account_manager_id && data.account_manager_id !== (before?.account_manager_id ?? null);
  if (managerChanged) await notify([data.account_manager_id!], me.id, "client", `You are now the account manager for ${data.name}`, `/admin/clients/${res.id}`);
  if (!id) {
    await logActivity(me.id, "create", "client", res.id, `Added client ${data.name}`);
    refresh();
    redirect(`/admin/clients/${res.id}?created=1`);
  }
  if (res.changed.length) await logActivity(me.id, "update", "client", res.id, `Updated client ${data.name}: ${res.changed.join(", ")}`);
  refresh(res.id);
  if (before && before.name !== data.name) revalidatePath("/admin/openings");
  return { ok: true, message: res.changed.length ? "Client saved." : "No changes to save." };
}

export async function deleteClientAction(form: FormData) {
  const me = await assertAdmin("clients.delete");
  const id = s(form.get("id"), 40);
  const res = await deleteClient(id);
  if (res === "has_openings") redirect(`/admin/clients/${id}?blocked=1`);
  if (res) await logActivity(me.id, "delete", "client", id, `Deleted client ${res.name}`);
  refresh();
  redirect("/admin/clients?deleted=1");
}

export async function addContactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("clients.edit");
  const clientId = s(form.get("clientId"), 40);
  const { data, errors } = parseContact(fields(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  if (!(await addContact(clientId, data, me.id))) return { error: "This client no longer exists." };
  await logActivity(me.id, "update", "client", clientId, `Added contact ${data.name}`);
  refresh(clientId);
  return { ok: true, message: "Contact added." };
}

export async function primaryContactAction(form: FormData) {
  const me = await assertAdmin("clients.edit");
  const clientId = await setPrimaryContact(s(form.get("id"), 40), me.id);
  if (clientId) refresh(clientId);
}

export async function deleteContactAction(form: FormData) {
  const me = await assertAdmin("clients.edit");
  const clientId = await deleteContact(s(form.get("id"), 40), me.id);
  if (clientId) {
    await logActivity(me.id, "update", "client", clientId, "Removed a client contact");
    refresh(clientId);
  }
}

export async function addRequirementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("clients.edit");
  const clientId = s(form.get("clientId"), 40);
  const { data, errors } = parseRequirement(fields(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const client = await getClient(clientId);
  if (!client || !(await addRequirement(clientId, data, me.id))) return { error: "This client no longer exists." };
  await logActivity(me.id, "create", "client", clientId, `New requirement for ${client.name}: ${data.positions} × ${data.title}`);
  if (client.account_manager_id) await notify([client.account_manager_id], me.id, "requirement", `New requirement from ${client.name}: ${data.positions} × ${data.title}`, `/admin/clients/${clientId}`);
  refresh(clientId);
  return { ok: true, message: "Requirement added." };
}

export async function requirementStatusAction(form: FormData) {
  const me = await assertAdmin("clients.edit");
  const clientId = await setRequirementStatus(s(form.get("id"), 40), s(form.get("status"), 20), me.id);
  if (clientId) refresh(clientId);
}

export async function deleteRequirementAction(form: FormData) {
  const me = await assertAdmin("clients.edit");
  const clientId = await deleteRequirement(s(form.get("id"), 40), me.id);
  if (clientId) {
    await logActivity(me.id, "delete", "client", clientId, "Removed a client requirement");
    refresh(clientId);
  }
}

export async function clientNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("clients.edit");
  const clientId = s(form.get("clientId"), 40);
  const body = s(form.get("body"), 4000);
  if (!body) return { errors: { body: "Write a note first." } };
  if (!(await addClientNote(clientId, body, me.id))) return { error: "This client no longer exists." };
  refresh(clientId);
  return { ok: true, message: "Note added." };
}

export async function clientFromEnquiryAction(form: FormData) {
  const me = await assertAdmin("clients.edit");
  const enquiryId = s(form.get("id"), 40);
  const res = await createClientFromEnquiry(enquiryId, me.id);
  if (!res) redirect("/admin/enquiries");
  await logActivity(me.id, res.existed ? "update" : "create", "client", res.id, res.existed ? "Added an enquiry to an existing client" : "Created a client from an enquiry");
  refresh(res.id);
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  redirect(`/admin/clients/${res.id}?${res.existed ? "linked" : "created"}=1`);
}
