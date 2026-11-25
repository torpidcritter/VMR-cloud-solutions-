"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, rateLimited } from "@/lib/guard";
import { endAllSessions, normaliseEmail, requireAdmin, signIn, signOut, startSession } from "@/lib/auth/session";
import { passwordProblem, verifyPassword } from "@/lib/auth/password";
import { countAdmins, createFirstAdmin, getPasswordHash, setPassword } from "@/lib/data/users";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

async function requestMeta() {
  const h = await headers();
  return { ip: clientIp(h), userAgent: h.get("user-agent") ?? "" };
}

/** Only allow same-site relative paths after sign-in. */
function safeNext(v: string) {
  return v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";
}

export async function signInAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = s(form.get("email"), 200);
  const password = s(form.get("password"), 200);
  if (!email || !password) return { error: "Enter your email and password.", data: { email } };
  const meta = await requestMeta();
  if (rateLimited(`admin-login:${meta.ip}`)) return { error: "Too many sign-in attempts from this network. Wait 10 minutes and try again.", data: { email } };
  const res = await signIn(email, password, meta);
  if (!res.ok) return { error: res.error, data: { email } };
  await logActivity(res.user.id, "signin", "user", res.user.id, `${res.user.name} signed in`);
  redirect(res.user.mustChangePassword ? "/admin/change-password" : safeNext(s(form.get("next"))));
}

export async function signOutAction() {
  await signOut();
  redirect("/admin/login");
}

export async function setupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const key = process.env.ADMIN_SETUP_KEY;
  const data = { name: s(form.get("name"), 120), email: s(form.get("email"), 200) };
  if (!key) return { error: "Setup is switched off. Add ADMIN_SETUP_KEY in Vercel first.", data };
  const meta = await requestMeta();
  if (rateLimited(`admin-setup:${meta.ip}`)) return { error: "Too many attempts. Wait 10 minutes and try again.", data };
  if (s(form.get("setupKey"), 200) !== key) return { error: "The setup key is not correct.", data };
  if ((await countAdmins()) > 0) redirect("/admin/login");

  const errors: Record<string, string> = {};
  const password = s(form.get("password"), 200);
  if (data.name.trim().length < 2) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = "Enter a valid email.";
  const problem = passwordProblem(password, data.email);
  if (problem) errors.password = problem;
  else if (password !== s(form.get("confirm"), 200)) errors.confirm = "The passwords don't match.";
  if (Object.keys(errors).length) return { errors, data };

  const id = await createFirstAdmin({ email: data.email, name: data.name, password });
  if (!id) redirect("/admin/login");
  await startSession(id, meta);
  await logActivity(id, "create", "user", id, `${data.name.trim()} created the first Super Admin account (${normaliseEmail(data.email)})`);
  redirect("/admin");
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const current = s(form.get("current"), 200);
  const next = s(form.get("password"), 200);
  const errors: Record<string, string> = {};
  const hash = await getPasswordHash(me.id);
  if (!hash || !(await verifyPassword(current, hash))) errors.current = "Your current password is not correct.";
  const problem = passwordProblem(next, me.email);
  if (problem) errors.password = problem;
  else if (next === current) errors.password = "Choose a password you haven't used here.";
  else if (next !== s(form.get("confirm"), 200)) errors.confirm = "The passwords don't match.";
  if (Object.keys(errors).length) return { errors };

  await setPassword(me.id, next, false);
  // Sign out other devices, keep this one signed in.
  await endAllSessions(me.id);
  await startSession(me.id, await requestMeta());
  await logActivity(me.id, "update", "user", me.id, `${me.name} changed their password`);
  redirect("/admin?password=changed");
}
