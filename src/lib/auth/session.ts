import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { can, type Permission, type Role } from "./permissions";
import { verifyPassword } from "./password";
import { recordLogin } from "@/lib/data/audit";

export const SESSION_COOKIE = "vmr_admin";
const SESSION_HOURS = 8;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

type SignInResult = { ok: true; user: AdminUser } | { ok: false; error: string };

const GENERIC = "That email and password don't match an active account.";

export async function signIn(emailRaw: string, password: string, meta: { ip?: string; userAgent?: string } = {}): Promise<SignInResult> {
  const email = normaliseEmail(emailRaw);
  const conn = await db();
  const [u] = await conn.query<{
    id: string;
    email: string;
    name: string;
    role: Role;
    password_hash: string;
    active: boolean;
    must_change_password: boolean;
    failed_attempts: number;
    locked_until: string | null;
  }>(`SELECT id, email, name, role, password_hash, active, must_change_password, failed_attempts, locked_until FROM admin_users WHERE email = $1`, [email]);

  const audit = { email, ip: meta.ip, userAgent: meta.userAgent };
  if (!u || !u.active) {
    // Same work as a real check so timing doesn't reveal which emails exist.
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    await recordLogin({ ...audit, userId: u?.id, outcome: u ? "inactive" : "unknown" });
    return { ok: false, error: GENERIC };
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await recordLogin({ ...audit, userId: u.id, outcome: "locked" });
    return { ok: false, error: `Too many attempts. Try again after ${LOCK_MINUTES} minutes, or ask a Super Admin to reset your password.` };
  }
  if (!(await verifyPassword(password, u.password_hash))) {
    const failed = Number(u.failed_attempts) + 1;
    await conn.query(
      `UPDATE admin_users SET failed_attempts = $2::int, locked_until = CASE WHEN $2::int >= $3::int THEN now() + ($4::text || ' minutes')::interval ELSE locked_until END WHERE id = $1`,
      [u.id, failed, MAX_FAILED, String(LOCK_MINUTES)],
    );
    await recordLogin({ ...audit, userId: u.id, outcome: "bad_password" });
    return { ok: false, error: GENERIC };
  }

  await conn.query(`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [u.id]);
  await startSession(u.id, meta);
  await conn.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  await recordLogin({ ...audit, userId: u.id, outcome: "success" });
  return { ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } };
}

export async function startSession(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const conn = await db();
  await conn.query(`INSERT INTO admin_sessions (id, user_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`, [
    sha256(token),
    userId,
    expires.toISOString(),
    (meta.ip || "").slice(0, 64),
    (meta.userAgent || "").slice(0, 300),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const conn = await db();
    await conn.query(`DELETE FROM admin_sessions WHERE id = $1`, [sha256(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

/** Signs out every session of a user (after a password reset or deactivation). */
export async function endAllSessions(userId: string) {
  const conn = await db();
  await conn.query(`DELETE FROM admin_sessions WHERE user_id = $1`, [userId]);
}

/** The signed-in admin for this request, or null. Cached per request. */
export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const conn = await db();
  const [u] = await conn.query<{ id: string; email: string; name: string; role: Role; must_change_password: boolean }>(
    `SELECT u.id, u.email, u.name, u.role, u.must_change_password
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.active`,
    [sha256(token)],
  );
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } : null;
});

/** For admin pages: redirects to sign-in, or to the dashboard when not allowed. */
export async function requireAdmin(permission?: Permission): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  if (permission && !can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

export class ForbiddenError extends Error {}

/** For server actions and API routes: throws instead of redirecting. */
export async function assertAdmin(permission?: Permission): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) throw new ForbiddenError("Please sign in again.");
  if (permission && !can(user.role, permission)) throw new ForbiddenError("Your role doesn't allow this.");
  return user;
}
