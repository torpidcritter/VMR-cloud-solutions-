import "server-only";
import { db } from "@/lib/db/client";
import { hashRecoveryCode, newRecoveryCodes, newTotpSecret, verifyTotp } from "@/lib/auth/totp";

/** Two-step sign-in for one account: setting it up, recovery codes, switching it off. */

export async function mfaStatus(userId: string) {
  const conn = await db();
  const [r] = await conn.query<{ enabled_at: string | null; pending: string | null; codes_left: number }>(
    `SELECT u.totp_enabled_at AS enabled_at, u.totp_pending_secret AS pending,
            (SELECT count(*)::int FROM admin_recovery_codes c WHERE c.user_id = u.id AND c.used_at IS NULL) AS codes_left
       FROM admin_users u WHERE u.id = $1`,
    [userId],
  );
  return r ? { enabledAt: r.enabled_at, pendingSecret: r.pending, codesLeft: Number(r.codes_left) } : null;
}

/** A new secret for the authenticator app; it only takes effect once a code from it is confirmed. */
export async function beginMfaSetup(userId: string) {
  const secret = newTotpSecret();
  const conn = await db();
  await conn.query(`UPDATE admin_users SET totp_pending_secret = $2 WHERE id = $1`, [userId, secret]);
  return secret;
}

async function replaceCodes(userId: string) {
  const codes = newRecoveryCodes();
  return {
    codes,
    statements: [
      { text: `DELETE FROM admin_recovery_codes WHERE user_id = $1`, params: [userId] },
      ...codes.map((c) => ({ text: `INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES ($1, $2)`, params: [userId, hashRecoveryCode(c)] })),
    ],
  };
}

/** Checks a code from the app against the pending secret; on success two-step sign-in is on and new recovery codes are returned (shown once). */
export async function confirmMfaSetup(userId: string, code: string) {
  const conn = await db();
  const [u] = await conn.query<{ pending: string | null }>(`SELECT totp_pending_secret AS pending FROM admin_users WHERE id = $1`, [userId]);
  if (!u?.pending) return null;
  const step = verifyTotp(u.pending, code, null);
  if (step === null) return null;
  const { codes, statements } = await replaceCodes(userId);
  await conn.tx([
    { text: `UPDATE admin_users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled_at = now(), totp_last_step = $2 WHERE id = $1`, params: [userId, step] },
    ...statements,
  ]);
  return codes;
}

/** Checks a current code for an account that already has two-step sign-in on (before switching it off or making new recovery codes). */
export async function checkCurrentCode(userId: string, code: string) {
  const conn = await db();
  const [u] = await conn.query<{ secret: string | null; last: string | null }>(`SELECT totp_secret AS secret, totp_last_step AS last FROM admin_users WHERE id = $1`, [userId]);
  if (!u?.secret) return false;
  const step = verifyTotp(u.secret, code, u.last == null ? null : Number(u.last));
  if (step === null) return false;
  return (await conn.query(`UPDATE admin_users SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING 1`, [userId, step])).length > 0;
}

export async function newRecoveryCodesFor(userId: string) {
  const { codes, statements } = await replaceCodes(userId);
  const conn = await db();
  await conn.tx(statements);
  return codes;
}

/** Switches two-step sign-in off (the person themselves, or a Super Admin for someone who lost their phone). */
export async function disableMfa(userId: string) {
  const conn = await db();
  const [r] = await conn.tx([
    { text: `UPDATE admin_users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1 AND totp_enabled_at IS NOT NULL RETURNING 1`, params: [userId] },
    { text: `DELETE FROM admin_recovery_codes WHERE user_id = $1`, params: [userId] },
    { text: `DELETE FROM mfa_challenges WHERE user_id = $1`, params: [userId] },
  ]);
  return r.length > 0;
}

