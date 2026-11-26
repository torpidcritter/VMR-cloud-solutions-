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
