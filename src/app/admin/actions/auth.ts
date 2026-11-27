"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, RATE_LIMIT_MAX, rateLimit, rateLimited } from "@/lib/guard";
import { currentAdmin, endAllSessions, normaliseEmail, requireAdmin, signIn, signOut, startSession, verifySecondStep } from "@/lib/auth/session";
import { passwordProblem, verifyPassword } from "@/lib/auth/password";
import { countAdmins, createFirstAdmin, getPasswordHash, setPassword } from "@/lib/data/users";
import { logActivity } from "@/lib/data/activity";
import { recordLogin } from "@/lib/data/audit";
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
  const limit = await rateLimit(`admin-login:${meta.ip}`);
  if (limit.limited) {
    // Only the first refused attempt in each window is logged, so a flood can't fill the log.
    if (limit.hits === RATE_LIMIT_MAX + 1) await recordLogin({ email, outcome: "rate_limited", ...meta });
    return { error: "Too many sign-in attempts from this network. Wait 10 minutes and try again.", data: { email } };
  }
  const res = await signIn(email, password, meta);
  if (!res.ok) return { error: res.error, data: { email } };
  if (res.needsCode) redirect(`/admin/login/verify?next=${encodeURIComponent(safeNext(s(form.get("next"))))}`);
  await logActivity(res.user.id, "signin", "user", res.user.id, `${res.user.name} signed in`);
  redirect(res.user.mustChangePassword ? "/admin/change-password" : safeNext(s(form.get("next"))));
}

/** Second sign-in step: the code from the authenticator app, or a recovery code. */
export async function verifyCodeAction(_: ActionState, form: FormData): Promise<ActionState> {
  const code = s(form.get("code"), 20);
  if (!code.trim()) return { error: "Enter the 6-digit code from your authenticator app." };
  const res = await verifySecondStep(code, await requestMeta());
  if (!res.ok) {
    if (/again/.test(res.error) && /password/.test(res.error)) redirect("/admin/login?expired=1");
    return { error: res.error };
  }
  if (res.needsCode) return { error: "Enter the code again." };
  await logActivity(res.user.id, "signin", "user", res.user.id, `${res.user.name} signed in (with two-step code)`);
  redirect(res.user.mustChangePassword ? "/admin/change-password" : safeNext(s(form.get("next"))));
}

export async function signOutAction() {
  const me = await currentAdmin();
  if (me) await recordLogin({ userId: me.id, email: me.email, outcome: "signout", ...(await requestMeta()) });
  await signOut();
  redirect("/admin/login");
}

export async function setupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const key = process.env.ADMIN_SETUP_KEY;
  const data = { name: s(form.get("name"), 120), email: s(form.get("email"), 200) };
  if (!key) return { error: "Setup is switched off. Add ADMIN_SETUP_KEY in Vercel first.", data };
  const meta = await requestMeta();
  if (await rateLimited(`admin-setup:${meta.ip}`)) return { error: "Too many attempts. Wait 10 minutes and try again.", data };
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
