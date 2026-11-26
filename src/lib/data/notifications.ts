import "server-only";
import { db } from "@/lib/db/client";

/**
 * In-app notifications: "you were assigned", "you're on an interview panel"
 * and similar. Shown under the bell in the admin header. Never emailed.
 */

const isUuid = (v?: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Only links inside the admin panel, so a notification can never send someone off-site. */
export const safeAdminLink = (link: string) => (/^\/admin(\/[A-Za-z0-9\-_/?=&.%]*)?$/.test(link) && !link.startsWith("//") ? link : "/admin");

export type Notification = { id: string; kind: string; title: string; link: string; read_at: string | null; created_at: string };

/**
 * Tells each person in `userIds`, except the one who did it. Failure is logged
 * and swallowed: a missing notification must never undo the work itself.
 */
export async function notify(userIds: (string | null | undefined)[], actorId: string | null, kind: string, title: string, link: string) {
  const ids = [...new Set(userIds.filter(isUuid))].filter((u) => u !== actorId);
  if (!ids.length) return 0;
  try {
    const conn = await db();
    const rows = await conn.query<{ id: string }>(
      `INSERT INTO notifications (user_id, kind, title, link)
       SELECT u.id, $2, $3, $4 FROM admin_users u WHERE u.id = ANY($1::uuid[]) AND u.active RETURNING id`,
      [ids, kind.slice(0, 40), title.slice(0, 300), safeAdminLink(link)],
    );
    return rows.length;
  } catch (err) {
    console.error("[notifications] could not record", err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function unreadCount(userId: string) {
  const conn = await db();
  const [{ n }] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  return Number(n);
}

export async function listNotifications(userId: string, limit = 100) {
  const conn = await db();
  return conn.query<Notification>(`SELECT id, kind, title, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
}

/** Marks one of the user's own notifications read and returns where it points. */
export async function openNotification(id: string, userId: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ link: string }>(`UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2 RETURNING link`, [id, userId]);
  return row ? safeAdminLink(row.link) : null;
}

export async function markAllRead(userId: string) {
  const conn = await db();
  await conn.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}
