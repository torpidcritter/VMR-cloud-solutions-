"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { createOpening, deleteOpening, getOpening, parseOpening, setOpeningStatus, updateOpening } from "@/lib/data/openings";
import { OPENING_STATUSES, OPENING_STATUS_LABELS, type OpeningStatus } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const UUID = /^[0-9a-f-]{36}$/i;

function refreshPublic(slug?: string) {
  revalidatePath("/careers");
  if (slug) revalidatePath(`/careers/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function saveOpeningAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("openings.edit");
  const raw = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
  const id = typeof raw.id === "string" && UUID.test(raw.id) ? raw.id : "";
  const { data, errors } = parseOpening(raw);
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };

  if (id) {
    const before = await getOpening(id);
    if (!before) return { error: "This opening no longer exists." };
    await updateOpening(id, data);
    await logActivity(me.id, "update", "opening", id, `Updated opening "${data.title}"${before.status !== data.status ? ` (${OPENING_STATUS_LABELS[before.status]} → ${OPENING_STATUS_LABELS[data.status]})` : ""}`);
    refreshPublic(before.slug);
    return { ok: true, message: data.status === "published" ? "Saved. The changes are live on the website." : "Saved." };
  }
  const newId = await createOpening(data, me.id);
  await logActivity(me.id, "create", "opening", newId, `Created opening "${data.title}" as ${OPENING_STATUS_LABELS[data.status]}`);
  refreshPublic();
  redirect(`/admin/openings/${newId}?created=1`);
}

export async function setOpeningStatusAction(form: FormData) {
  const me = await assertAdmin("openings.edit");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as OpeningStatus;
  if (!UUID.test(id) || !OPENING_STATUSES.includes(status)) return;
  const o = await getOpening(id);
  if (!o) return;
  if (status === "published") {
    const { errors } = parseOpening({ ...o, skills: o.skills.join(", "), status: "published", closing_date: o.closing_date ?? "" });
    if (Object.keys(errors).length) redirect(`/admin/openings/${id}?incomplete=1`);
  }
  await setOpeningStatus(id, status);
  await logActivity(me.id, "status", "opening", id, `${OPENING_STATUS_LABELS[o.status]} → ${OPENING_STATUS_LABELS[status]}: "${o.title}"`);
  refreshPublic(o.slug);
  revalidatePath("/admin/openings");
  revalidatePath(`/admin/openings/${id}`);
}

export async function duplicateOpeningAction(form: FormData) {
  const me = await assertAdmin("openings.edit");
  const o = await getOpening(String(form.get("id") ?? ""));
  if (!o) return;
  const { data } = parseOpening({ ...o, title: `${o.title} (copy)`.slice(0, 160), skills: o.skills.join(", "), status: "draft", closing_date: o.closing_date ?? "" });
  const newId = await createOpening(data, me.id);
  await logActivity(me.id, "create", "opening", newId, `Duplicated "${o.title}" as a draft`);
  redirect(`/admin/openings/${newId}?created=1`);
}

export async function deleteOpeningAction(form: FormData) {
  const me = await assertAdmin("openings.delete");
  const o = await getOpening(String(form.get("id") ?? ""));
  if (!o) redirect("/admin/openings");
  await deleteOpening(o.id);
  await logActivity(me.id, "delete", "opening", o.id, `Deleted opening "${o.title}" (its applications are kept)`);
  refreshPublic(o.slug);
  redirect("/admin/openings?deleted=1");
}
