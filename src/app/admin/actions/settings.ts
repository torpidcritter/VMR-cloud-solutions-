"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/session";
import { getSettings, saveSettings, type Settings } from "@/lib/data/settings";
import { RETENTION_CHOICES } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const EMAILS = /^([^\s@,]+@[^\s@,]+\.[^\s@,]+)(\s*,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+)*$/;

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("settings.manage");
  const value: Settings = {
    applicationsEmail: String(form.get("applicationsEmail") ?? "").trim().slice(0, 500),
    enquiriesEmail: String(form.get("enquiriesEmail") ?? "").trim().slice(0, 500),
    notifyApplications: form.get("notifyApplications") === "on",
    notifyEnquiries: form.get("notifyEnquiries") === "on",
    showCareerAreasFallback: form.get("showCareerAreasFallback") === "on",
    auditRetentionDays: Number(form.get("auditRetentionDays")),
  };
  const errors: Record<string, string> = {};
  if (!EMAILS.test(value.applicationsEmail)) errors.applicationsEmail = "Enter one or more email addresses, separated by commas.";
  if (!EMAILS.test(value.enquiriesEmail)) errors.enquiriesEmail = "Enter one or more email addresses, separated by commas.";
  if (!(RETENTION_CHOICES as readonly number[]).includes(value.auditRetentionDays)) errors.auditRetentionDays = "Choose one of the listed periods.";
  if (Object.keys(errors).length) return { errors };
  const before = await getSettings();
  await saveSettings(value);
  const changed = (Object.keys(value) as (keyof Settings)[]).filter((k) => before[k] !== value[k]);
  await logActivity(me.id, "update", "settings", null, changed.length ? `Updated settings: ${changed.map((k) => `${k} ${String(before[k])} → ${String(value[k])}`).join("; ")}` : "Saved settings (no changes)");
  revalidatePath("/careers");
  return { ok: true, message: "Settings saved." };
}
