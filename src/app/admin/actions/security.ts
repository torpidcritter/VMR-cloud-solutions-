"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, endAllSessions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getAdmin, getPasswordHash } from "@/lib/data/users";
import { beginMfaSetup, checkCurrentCode, confirmMfaSetup, disableMfa, newRecoveryCodesFor } from "@/lib/data/mfa";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Step 1: a new secret to scan. Nothing changes for sign-in until a code is confirmed. */
export async function startMfaSetupAction() {
  const me = await assertAdmin();
  await beginMfaSetup(me.id);
  redirect("/admin/security?setup=1");
}

/** Step 2: the first code from the app switches two-step sign-in on and returns recovery codes, shown once. */
export async function confirmMfaSetupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin();
  const codes = await confirmMfaSetup(me.id, s(form.get("code"), 12));
  if (!codes) return { error: "That code didn't match. Make sure you scanned the code on this page, then enter the newest 6-digit code." };
  await logActivity(me.id, "update", "user", me.id, `${me.name} turned on two-step sign-in`);
  // No revalidation here: refreshing the page would replace the form before the codes are read.
  return { ok: true, persist: true, message: "Two-step sign-in is on.", data: { codes: codes.join(" ") } };
}

/** New recovery codes (the old ones stop working). Needs a current code from the app. */
export async function newRecoveryCodesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin();
  if (!(await checkCurrentCode(me.id, s(form.get("code"), 12)))) return { error: "That code didn't match. Enter the newest code from your authenticator app." };
  const codes = await newRecoveryCodesFor(me.id);
  await logActivity(me.id, "update", "user", me.id, `${me.name} made new two-step recovery codes`);
  return { ok: true, persist: true, message: "New recovery codes made. The old ones no longer work.", data: { codes: codes.join(" ") } };
}

/** Switching it off needs the password and a current code, so a borrowed session can't do it. */
export async function disableOwnMfaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin();
  const hash = await getPasswordHash(me.id);
  if (!hash || !(await verifyPassword(s(form.get("password"), 200), hash))) return { error: "That password isn't right." };
  if (!(await checkCurrentCode(me.id, s(form.get("code"), 12)))) return { error: "That code didn't match. Enter the newest code from your authenticator app." };
  await disableMfa(me.id);
  await logActivity(me.id, "update", "user", me.id, `${me.name} turned off two-step sign-in`);
  revalidatePath("/admin/security");
  return { ok: true, message: "Two-step sign-in is off for your account." };
}

/** A Super Admin switches it off for someone who lost their phone and recovery codes; they're signed out everywhere. */
export async function resetUserMfaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("users.manage");
  const user = await getAdmin(s(form.get("id"), 40));
  if (!user) return { error: "This user no longer exists." };
  if (user.id === me.id) return { error: "Use your own Two-step sign-in page to change this for your account." };
  if (!(await disableMfa(user.id))) return { error: `${user.name} doesn't have two-step sign-in on.` };
  await endAllSessions(user.id);
  await logActivity(me.id, "update", "user", user.id, `Switched off two-step sign-in for ${user.name} (lost device)`);
  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true, message: `Two-step sign-in is off for ${user.name}. They can set it up again after signing in.` };
}
