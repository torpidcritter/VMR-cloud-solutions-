import "server-only";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { normaliseEmail } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/permissions";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
};

export async function countAdmins() {
  const conn = await db();
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM admin_users`);
  return Number(count);
}

export async function listAdmins() {
  const conn = await db();
  return conn.query<AdminUserRow>(
    `SELECT id, email, name, role, active, must_change_password, locked_until, last_login_at, created_at FROM admin_users ORDER BY active DESC, name`,
  );
}

export async function getAdmin(id: string) {
  const conn = await db();
  const [row] = await conn.query<AdminUserRow>(
    `SELECT id, email, name, role, active, must_change_password, locked_until, last_login_at, created_at FROM admin_users WHERE id = $1`,
    [id],
  );
  return row ?? null;
}

export class DuplicateEmailError extends Error {}

export async function createAdmin({ email, name, role, password, mustChange }: { email: string; name: string; role: Role; password: string; mustChange: boolean }) {
  const conn = await db();
  const hash = await hashPassword(password);
  const rows = await conn.query<{ id: string }>(
    `INSERT INTO admin_users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [normaliseEmail(email), name.trim(), role, hash, mustChange],
  );
  if (!rows[0]) throw new DuplicateEmailError("An admin with that email already exists.");
  return rows[0].id;
}

/** Creates the first Super Admin only while the table is empty (race-safe). */
export async function createFirstAdmin({ email, name, password }: { email: string; name: string; password: string }) {
  const conn = await db();
  const hash = await hashPassword(password);
  const rows = await conn.query<{ id: string }>(
    `INSERT INTO admin_users (email, name, role, password_hash)
     SELECT $1, $2, 'super_admin', $3 WHERE NOT EXISTS (SELECT 1 FROM admin_users) RETURNING id`,
    [normaliseEmail(email), name.trim(), hash],
  );
  return rows[0]?.id ?? null;
}

export async function updateAdmin(id: string, { name, role, active }: { name: string; role: Role; active: boolean }) {
  const conn = await db();
  await conn.query(`UPDATE admin_users SET name = $2, role = $3, active = $4, updated_at = now() WHERE id = $1`, [id, name.trim(), role, active]);
}

export async function setPassword(id: string, password: string, mustChange: boolean) {
  const conn = await db();
  await conn.query(
    `UPDATE admin_users SET password_hash = $2, must_change_password = $3, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1`,
    [id, await hashPassword(password), mustChange],
  );
}

export async function getPasswordHash(id: string) {
  const conn = await db();
  const [row] = await conn.query<{ password_hash: string }>(`SELECT password_hash FROM admin_users WHERE id = $1`, [id]);
  return row?.password_hash ?? null;
}

export async function countActiveSuperAdmins(exceptId?: string) {
  const conn = await db();
  const [{ count }] = await conn.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM admin_users WHERE role = 'super_admin' AND active AND id <> COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
    [exceptId ?? null],
  );
  return Number(count);
}
