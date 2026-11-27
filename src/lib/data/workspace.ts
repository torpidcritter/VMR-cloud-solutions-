import "server-only";
import { db } from "@/lib/db/client";
import { dueFollowUps } from "./candidates";
import { listInterviews } from "./interviews";
import { istToday } from "./constants";

/** First day of the current month in IST, as YYYY-MM-01. */
export const currentMonth = () => `${istToday().slice(0, 7)}-01`;

export async function getTarget(userId: string, month = currentMonth()) {
  const conn = await db();
  const [row] = await conn.query<{ placements: number }>(`SELECT placements FROM recruiter_targets WHERE user_id = $1 AND month = $2::date`, [userId, month]);
  return row ? Number(row.placements) : null;
}

export async function setTarget(userId: string, placements: number | null, month = currentMonth()) {
  const conn = await db();
  if (placements === null) await conn.query(`DELETE FROM recruiter_targets WHERE user_id = $1 AND month = $2::date`, [userId, month]);
  else
    await conn.query(
      `INSERT INTO recruiter_targets (user_id, month, placements) VALUES ($1, $2::date, $3)
       ON CONFLICT (user_id, month) DO UPDATE SET placements = EXCLUDED.placements`,
      [userId, month, placements],
    );
}

export type StaleApplication = { id: string; number: string; full_name: string; candidate_id: string; status: string; position: string; opening_title: string | null; days: number };

/** Everything one recruiter needs for their day. */
export async function myWork(userId: string) {
  const conn = await db();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const startOfToday = new Date(`${istToday()}T00:00:00+05:30`).toISOString();
  const month = currentMonth();

  const [byStage, stale, followUps, interviews, openings, hires, target, recent] = await Promise.all([
    conn.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM applications WHERE assigned_to = $1 AND status NOT IN ('hired','rejected') GROUP BY status`,
      [userId],
    ),
    conn.query<StaleApplication>(
      `SELECT a.id, a.number, c.full_name, c.id AS candidate_id, a.status, a.position, o.title AS opening_title,
              floor(extract(epoch FROM now() - a.stage_changed_at) / 86400)::int AS days
         FROM applications a JOIN candidates c ON c.id = a.candidate_id LEFT JOIN job_openings o ON o.id = a.opening_id
        WHERE a.assigned_to = $1 AND a.status NOT IN ('hired','rejected','on_hold') AND a.stage_changed_at < now() - interval '7 days'
        ORDER BY a.stage_changed_at LIMIT 10`,
      [userId],
    ),
    dueFollowUps(userId, 15),
    listInterviews({ userId, from: startOfToday, to: weekAhead, status: "scheduled" }, 30),
    conn.query<{ id: string; title: string; status: string; vacancies: number; applications: number; hired: number }>(
      `SELECT o.id, o.title, o.status, o.vacancies,
              (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id) AS applications,
              (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id AND a.status = 'hired') AS hired
         FROM opening_recruiters r JOIN job_openings o ON o.id = r.opening_id
        WHERE r.user_id = $1 AND o.status IN ('published','paused','draft') ORDER BY o.updated_at DESC LIMIT 12`,
      [userId],
    ),
    conn.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM applications
        WHERE assigned_to = $1 AND hired_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata')
          AND hired_at < (($2::date + interval '1 month')::timestamp AT TIME ZONE 'Asia/Kolkata')`,
      [userId, month],
    ),
    getTarget(userId, month),
    conn.query<{ id: string; action: string; entity: string; entity_id: string | null; summary: string; created_at: string }>(
      `SELECT id, action, entity, entity_id, summary, created_at FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [userId],
    ),
  ]);

  const open = byStage.reduce((n, r) => n + Number(r.count), 0);
  return {
    open,
    byStage: Object.fromEntries(byStage.map((r) => [r.status, Number(r.count)])) as Record<string, number>,
    stale,
    followUps,
    interviews,
    openings,
    hiresThisMonth: Number(hires[0]?.count ?? 0),
    target,
    recent,
  };
}
