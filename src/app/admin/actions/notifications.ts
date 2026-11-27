"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { markAllRead, openNotification } from "@/lib/data/notifications";

/** Marks the notification read and goes to what it is about. Only the owner can open it. */
export async function openNotificationAction(form: FormData) {
  const me = await assertAdmin();
  const id = String(form.get("id") ?? "").slice(0, 40);
  const link = await openNotification(id, me.id);
  revalidatePath("/admin", "layout");
  redirect(link ?? "/admin/notifications");
}

export async function markAllReadAction() {
  const me = await assertAdmin();
  await markAllRead(me.id);
  revalidatePath("/admin", "layout");
}
