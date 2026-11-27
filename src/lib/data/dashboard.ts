import "server-only";
import { db } from "@/lib/db/client";
import { ACTIVE_SHORTLIST } from "./constants";

/** Every dashboard figure is counted from live records. */
export async function dashboardStats() {
  const conn = await db();
  const [apps] = await conn.query<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'new')::int AS new,
            count(*) FILTER (WHERE status = 'screening')::int AS screening,
            count(*) FILTER (WHERE status IN (${ACTIVE_SHORTLIST.map((x) => `'${x}'`).join(",")}))::int AS shortlisted,
            count(*) FILTER (WHERE status = 'hired')::int AS hired,
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
            count(*) FILTER (WHERE submitted_at >= now() - interval '7 days')::int AS last7
       FROM applications`,
  );
  const [openings] = await conn.query<Record<string, number>>(
    `SELECT count(*) FILTER (WHERE status = 'published')::int AS published,
            count(*) FILTER (WHERE status = 'draft')::int AS draft,
            count(*)::int AS total
       FROM job_openings`,
  );
  const [talent] = await conn.query<{ candidates: number; resumes: number }>(
    `SELECT (SELECT count(*)::int FROM candidates) AS candidates,
            (SELECT count(*)::int FROM applications WHERE resume_path IS NOT NULL) AS resumes`,
  );
  const [enq] = await conn.query<Record<string, number>>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'new')::int AS new FROM enquiries`,
  );
  // Applications per ISO week (IST), last 12 weeks, zero-filled.
  const weekly = await conn.query<{ week: string; count: number }>(
    `WITH weeks AS (
       SELECT generate_series(date_trunc('week', (now() AT TIME ZONE 'Asia/Kolkata')) - interval '11 weeks',
                              date_trunc('week', (now() AT TIME ZONE 'Asia/Kolkata')), interval '1 week') AS w)
     SELECT to_char(weeks.w, 'YYYY-MM-DD') AS week,
            (SELECT count(*)::int FROM applications a WHERE date_trunc('week', a.submitted_at AT TIME ZONE 'Asia/Kolkata') = weeks.w) AS count
       FROM weeks ORDER BY weeks.w`,
  );
  const topOpenings = await conn.query<{ id: string; title: string; applications: number; new_applications: number }>(
    `SELECT o.id, o.title, count(a.id)::int AS applications, count(a.id) FILTER (WHERE a.status = 'new')::int AS new_applications
       FROM job_openings o LEFT JOIN applications a ON a.opening_id = o.id
      WHERE o.status = 'published' GROUP BY o.id ORDER BY applications DESC, o.title LIMIT 6`,
  );
  const recent = await conn.query<{ id: string; number: string; full_name: string; position: string; status: string; submitted_at: string; source: string }>(
    `SELECT a.id, a.number, c.full_name, a.position, a.status, a.submitted_at, a.source
       FROM applications a JOIN candidates c ON c.id = a.candidate_id ORDER BY a.submitted_at DESC LIMIT 6`,
  );
  const num = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)])) as Record<string, number>;
  return {
    applications: num(apps),
    openings: num(openings),
    talent: num(talent),
    enquiries: num(enq),
    weekly: weekly.map((w) => ({ week: w.week, count: Number(w.count) })),
    topOpenings,
    recent,
  };
}
