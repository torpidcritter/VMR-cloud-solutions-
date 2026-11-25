import "server-only";
import { db } from "@/lib/db/client";

export async function logActivity(userId: string | null, action: string, entity: string, entityId: string | null, summary: string) {
  const conn = await db();
  await conn.query(`INSERT INTO activity_log (user_id, action, entity, entity_id, summary) VALUES ($1, $2, $3, $4, $5)`, [
    userId,
    action,
    entity,
    entityId,
    summary.slice(0, 500),
  ]);
}

export type ActivityRow = { id: string; action: string; entity: string; entity_id: string | null; summary: string; created_at: string; user_name: string | null };

export async function listActivity({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const conn = await db();
  const rows = await conn.query<ActivityRow>(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.created_at, u.name AS user_name
       FROM activity_log a LEFT JOIN admin_users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM activity_log`);
  return { rows, total: Number(count) };
}
