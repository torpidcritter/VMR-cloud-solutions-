"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, endAllSessions } from "@/lib/auth/session";
import { isRole, ROLE_LABELS } from "@/lib/auth/permissions";
import { temporaryPassword } from "@/lib/auth/password";
import { countActiveSuperAdmins, createAdmin, DuplicateEmailError, getAdmin, setPassword, updateAdmin } from "@/lib/data/users";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function inviteUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("users.manage");
  const name = s(form.get("name"), 120);
  const email = s(form.get("email"));
  const role = s(form.get("role"));
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter their name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";
  if (!isRole(role)) errors.role = "Choose a role.";
  if (Object.keys(errors).length) return { errors, data: { name, email, role } };
  const password = temporaryPassword();
  try {
    const id = await createAdmin({ email, name, role: role as never, password, mustChange: true });
    await logActivity(me.id, "create", "user", id, `Added ${name} (${email}) as ${ROLE_LABELS[role as keyof typeof ROLE_LABELS]}`);
  } catch (err) {
    if (err instanceof DuplicateEmailError) return { errors: { email: err.message }, data: { name, email, role } };
    throw err;
  }
  revalidatePath("/admin/users");
  return {
    ok: true,
    persist: true,
    message: `Account created. Share these sign-in details with ${name} privately: email ${email.toLowerCase()}, temporary password ${password}. They'll choose their own password when they first sign in. This password won't be shown again.`,
  };
}

export async function updateUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("users.manage");
  const id = s(form.get("id"), 40);
  const user = await getAdmin(id);
  if (!user) return { error: "This user no longer exists." };
  const name = s(form.get("name"), 120);
  const role = s(form.get("role"));
  const active = form.get("active") === "on";
  if (name.length < 2) return { errors: { name: "Enter their name." } };
  if (!isRole(role)) return { errors: { role: "Choose a role." } };
  const losesSuper = user.role === "super_admin" && user.active && (role !== "super_admin" || !active);
  if (losesSuper && (await countActiveSuperAdmins(user.id)) === 0) {
    return { error: "There must always be at least one active Super Admin. Make someone else a Super Admin first." };
  }
  await updateAdmin(id, { name, role, active });
  if (!active || role !== user.role) await endAllSessions(id);
  const changes = [
    user.name !== name && "name",
    user.role !== role && `role ${ROLE_LABELS[user.role]} → ${ROLE_LABELS[role]}`,
    user.active !== active && (active ? "reactivated" : "deactivated"),
  ].filter(Boolean);
  await logActivity(me.id, "update", "user", id, `Updated ${name}: ${changes.join(", ") || "no changes"}`);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, message: id === me.id && (role !== user.role || !active) ? "Saved. You've been signed out of this account's sessions." : "Saved." };
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("users.manage");
  const user = await getAdmin(s(form.get("id"), 40));
  if (!user) return { error: "This user no longer exists." };
  const password = temporaryPassword();
  await setPassword(user.id, password, true);
  await endAllSessions(user.id);
  await logActivity(me.id, "update", "user", user.id, `Reset the password for ${user.name}`);
  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true, persist: true, message: `New temporary password for ${user.name}: ${password}. Share it privately; they'll set their own when they sign in. Any lock on the account is cleared.` };
}
