"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { deleteEnquiry, getEnquiry, updateEnquiry } from "@/lib/data/enquiries";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

export async function updateEnquiryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("enquiries.update");
  const e = await getEnquiry(String(form.get("id") ?? ""));
  if (!e) return { error: "This enquiry no longer exists." };
  const status = String(form.get("status") ?? "") as EnquiryStatus;
  if (!ENQUIRY_STATUSES.includes(status)) return { error: "Choose a status." };
  const notes = String(form.get("notes") ?? "");
  await updateEnquiry(e.id, status, notes);
  await logActivity(
    me.id,
    "update",
    "enquiry",
    e.id,
    `Enquiry #${e.number} from ${e.name}${e.status !== status ? `: ${ENQUIRY_STATUS_LABELS[e.status]} → ${ENQUIRY_STATUS_LABELS[status]}` : ": notes updated"}`,
  );
  revalidatePath(`/admin/enquiries/${e.id}`);
  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Saved." };
}

export async function deleteEnquiryAction(form: FormData) {
  const me = await assertAdmin("enquiries.update");
  const e = await getEnquiry(String(form.get("id") ?? ""));
  if (!e) redirect("/admin/enquiries");
  await deleteEnquiry(e.id);
  await logActivity(me.id, "delete", "enquiry", e.id, `Deleted enquiry #${e.number}`);
  redirect("/admin/enquiries?deleted=1");
}
