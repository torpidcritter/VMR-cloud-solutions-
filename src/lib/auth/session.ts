import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { can, type Permission, type Role } from "./permissions";
import { verifyPassword } from "./password";
import { recordLogin } from "@/lib/data/audit";
import { hashRecoveryCode, verifyTotp } from "./totp";

export const SESSION_COOKIE = "vmr_admin";
/** Holds the pending two-step challenge between the password and the code. */
export const MFA_COOKIE = "vmr_admin_mfa";
const MFA_MINUTES = 5;
const MFA_MAX_ATTEMPTS = 5;
const SESSION_HOURS = 8;
/** A session also ends after this long without a page view or action. */
export const IDLE_MINUTES = 60;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  /** Two-step sign-in (authenticator app) is on for this account. */
  mfaEnabled?: boolean;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

type SignInResult = { ok: true; needsCode: false; user: AdminUser } | { ok: true; needsCode: true } | { ok: false; error: string };

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
    totp_enabled_at: string | null;
  }>(`SELECT id, email, name, role, password_hash, active, must_change_password, failed_attempts, locked_until, totp_enabled_at FROM admin_users WHERE email = $1`, [email]);

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

  await conn.query(`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`, [u.id]);
  if (u.totp_enabled_at) {
    // Right password; the code from the authenticator app comes next.
    await startChallenge(u.id);
    return { ok: true, needsCode: true };
  }
  await conn.query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [u.id]);
  await startSession(u.id, meta);
  await conn.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  await recordLogin({ ...audit, userId: u.id, outcome: "success" });
  return { ok: true, needsCode: false, user: { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } };
}

async function startChallenge(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + MFA_MINUTES * 60_000);
  const conn = await db();
  await conn.query(`DELETE FROM mfa_challenges WHERE user_id = $1 OR expires_at < now()`, [userId]);
  await conn.query(`INSERT INTO mfa_challenges (id, user_id, expires_at) VALUES ($1, $2, $3)`, [sha256(token), userId, expires.toISOString()]);
  (await cookies()).set(MFA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin", expires });
}

/** Whether this browser is between the password and the code. */
export async function pendingChallenge() {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return false;
  const conn = await db();
  const [c] = await conn.query(`SELECT 1 FROM mfa_challenges WHERE id = $1 AND expires_at > now() AND attempts < $2`, [sha256(token), MFA_MAX_ATTEMPTS]);
  return !!c;
}

/**
 * Second step: a 6-digit code from the authenticator app, or one of the
 * recovery codes. Five wrong codes end the challenge and the person starts
 * again from the password.
 */
export async function verifySecondStep(codeRaw: string, meta: { ip?: string; userAgent?: string } = {}): Promise<SignInResult> {
  const jar = await cookies();
  const token = jar.get(MFA_COOKIE)?.value;
  const expired = { ok: false as const, error: "Your sign-in timed out. Enter your email and password again." };
  if (!token) return expired;
  const conn = await db();
  // Count the attempt first, in the same statement that finds the challenge, so parallel guesses can't exceed the limit.
  const [c] = await conn.query<{ user_id: string; attempts: number }>(
    `UPDATE mfa_challenges SET attempts = attempts + 1 WHERE id = $1 AND expires_at > now() AND attempts < $2 RETURNING user_id, attempts`,
    [sha256(token), MFA_MAX_ATTEMPTS],
  );
  if (!c) {
    jar.delete(MFA_COOKIE);
    return expired;
  }
  const [u] = await conn.query<{ id: string; email: string; name: string; role: Role; must_change_password: boolean; active: boolean; totp_secret: string | null; totp_last_step: string | null }>(
    `SELECT id, email, name, role, must_change_password, active, totp_secret, totp_last_step FROM admin_users WHERE id = $1`,
    [c.user_id],
  );
  if (!u || !u.active || !u.totp_secret) {
    await conn.query(`DELETE FROM mfa_challenges WHERE id = $1`, [sha256(token)]);
    jar.delete(MFA_COOKIE);
    return expired;
  }
  const audit = { userId: u.id, email: u.email, ip: meta.ip, userAgent: meta.userAgent };
  const code = codeRaw.trim();
  let ok = false;
  if (/^\d[\d\s]{5,7}$/.test(code)) {
    const step = verifyTotp(u.totp_secret, code, u.totp_last_step == null ? null : Number(u.totp_last_step));
    // Only one sign-in per code: the step is claimed in the same statement that checks it.
    if (step !== null) ok = (await conn.query(`UPDATE admin_users SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING 1`, [u.id, step])).length > 0;
  } else if (/^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(code)) {
    ok = (await conn.query(`UPDATE admin_recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING 1`, [u.id, hashRecoveryCode(code.replace("-", "").replace(/^(.{4})/, "$1-"))])).length > 0;
  }
  if (!ok) {
    await recordLogin({ ...audit, outcome: "mfa_failed" });
    const left = MFA_MAX_ATTEMPTS - Number(c.attempts);
    if (left <= 0) {
      await conn.query(`DELETE FROM mfa_challenges WHERE id = $1`, [sha256(token)]);
      jar.delete(MFA_COOKIE);
      return { ok: false, error: "Too many wrong codes. Enter your email and password again." };
    }
    return { ok: false, error: `That code isn't right. Check the time on your phone and try the newest code (${left} ${left === 1 ? "try" : "tries"} left).` };
  }
  await conn.query(`DELETE FROM mfa_challenges WHERE id = $1`, [sha256(token)]);
  jar.delete(MFA_COOKIE);
  await conn.query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [u.id]);
  await startSession(u.id, meta);
  await recordLogin({ ...audit, outcome: "success" });
  return { ok: true, needsCode: false, user: { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } };
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
  // Each request counts as activity; a session idle for IDLE_MINUTES no longer matches.
  const [u] = await conn.query<{ id: string; email: string; name: string; role: Role; must_change_password: boolean; mfa: boolean }>(
    `WITH s AS (
       UPDATE admin_sessions SET last_seen_at = now()
        WHERE id = $1 AND expires_at > now() AND last_seen_at > now() - ($2::int * interval '1 minute')
        RETURNING user_id
     )
     SELECT u.id, u.email, u.name, u.role, u.must_change_password, u.totp_enabled_at IS NOT NULL AS mfa
       FROM s JOIN admin_users u ON u.id = s.user_id
      WHERE u.active`,
    [sha256(token), IDLE_MINUTES],
  );
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password, mfaEnabled: !!u.mfa } : null;
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
