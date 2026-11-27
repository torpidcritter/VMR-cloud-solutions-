import "server-only";
import { db } from "@/lib/db/client";
import { pipelineConversion } from "./applications";
import { FUNNEL_STAGES } from "./constants";
import { isIsoDate } from "@/lib/dates";

/**
 * Recruitment analytics, counted live from applications, their status
 * history, interviews and openings. A range filters applications by the date
 * they arrived, hires by the date they were marked Hired.
 */

export type Range = { from?: string; to?: string };

const isDate = (v?: string | null) => isIsoDate(v);
const FUNNEL = `ARRAY[${FUNNEL_STAGES.map((x) => `'${x}'`).join(",")}]::text[]`;
/** 1 = new … 8 = hired: the furthest forward stage an application ever reached. */
const RANK = `GREATEST(COALESCE(array_position(${FUNNEL}, a.status), 1),
  COALESCE((SELECT max(array_position(${FUNNEL}, e.to_status)) FROM application_events e WHERE e.application_id = a.id AND e.kind = 'status'), 1))`;
const SHORTLIST_RANK = FUNNEL_STAGES.indexOf("shortlisted") + 1;
const INTERVIEW_RANK = FUNNEL_STAGES.indexOf("interview_scheduled") + 1;
/** When an application was first marked Hired. */
const HIRED_AT = `COALESCE(a.hired_at, (SELECT max(e.created_at) FROM application_events e WHERE e.application_id = a.id AND e.kind = 'status' AND e.to_status = 'hired'), a.stage_changed_at)`;

/** SQL conditions for a date column within the range (IST calendar days). */
function within(col: string, r: Range, params: unknown[]) {
  const out: string[] = [];
  if (isDate(r.from)) {
    params.push(r.from);
    out.push(`${col} >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
  if (isDate(r.to)) {
    params.push(r.to);
    out.push(`${col} < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
  return out.length ? out.join(" AND ") : "true";
}

const num = (v: unknown) => Number(v ?? 0);

export type Breakdown = { key: string; label: string; applications: number; shortlisted: number; interviewed: number; hired: number };

async function breakdown(groupSql: string, labelSql: string, join: string, r: Range, extraWhere = "true", limit = 50): Promise<Breakdown[]> {
  const conn = await db();
  const params: unknown[] = [];
  const range = within("a.submitted_at", r, params);
  const rows = await conn.query<Record<string, unknown>>(
    `WITH x AS (SELECT ${groupSql} AS key, ${labelSql} AS label, ${RANK} AS rank FROM applications a ${join} WHERE ${range} AND ${extraWhere})
     SELECT key::text, min(label) AS label, count(*)::int AS applications,
            count(*) FILTER (WHERE rank >= ${SHORTLIST_RANK})::int AS shortlisted,
            count(*) FILTER (WHERE rank >= ${INTERVIEW_RANK})::int AS interviewed,
            count(*) FILTER (WHERE rank >= ${FUNNEL_STAGES.length})::int AS hired
       FROM x GROUP BY key ORDER BY applications DESC, min(label) LIMIT ${limit}`,
    params,
  );
  return rows.map((r) => ({ key: String(r.key ?? ""), label: String(r.label ?? ""), applications: num(r.applications), shortlisted: num(r.shortlisted), interviewed: num(r.interviewed), hired: num(r.hired) }));
}

export const bySource = (r: Range) => breakdown("a.source", "a.source", "", r);
export const byOpening = (r: Range) =>
  breakdown("COALESCE(a.opening_id::text, 'none')", "COALESCE(o.title, 'Not linked to an opening')", "LEFT JOIN job_openings o ON o.id = a.opening_id", r, "true", 25);
export const byRecruiter = (r: Range) =>
  breakdown("COALESCE(a.assigned_to::text, 'none')", "COALESCE(u.name, 'Unassigned')", "LEFT JOIN admin_users u ON u.id = a.assigned_to", r);
/** Confidential: only for roles that may see client names. */
export const byClient = (r: Range) =>
  breakdown(
    "COALESCE(o.client_id::text, 'none')",
    "COALESCE(cl.name, 'No client')",
    "LEFT JOIN job_openings o ON o.id = a.opening_id LEFT JOIN clients cl ON cl.id = o.client_id",
    r,
    "a.opening_id IS NOT NULL",
  );

/** Days from application to hire for hires made in the range. */
export async function timeToHire(r: Range) {
  const conn = await db();
  const params: unknown[] = [];
  const [row] = await conn.query<{ hires: number; avg_days: number | null; median_days: number | null; fastest: number | null; slowest: number | null }>(
    `WITH h AS (SELECT a.submitted_at, ${HIRED_AT} AS hired_at FROM applications a WHERE a.status = 'hired'),
     d AS (SELECT EXTRACT(EPOCH FROM (hired_at - submitted_at)) / 86400.0 AS days FROM h WHERE ${within("hired_at", r, params)})
     SELECT count(*)::int AS hires, avg(days)::float8 AS avg_days,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::float8 AS median_days, min(days)::float8 AS fastest, max(days)::float8 AS slowest
       FROM d`,
    params,
  );
  const round = (v: number | null) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);
  return { hires: num(row?.hires), avgDays: round(row?.avg_days ?? null), medianDays: round(row?.median_days ?? null), fastest: round(row?.fastest ?? null), slowest: round(row?.slowest ?? null) };
}

/** How long new applications wait for their first move out of New. */
export async function timeToFirstAction(r: Range) {
  const conn = await db();
  const params: unknown[] = [];
  const [row] = await conn.query<{ moved: number; waiting: number; avg_hours: number | null }>(
    `WITH x AS (
       SELECT a.submitted_at, (SELECT min(e.created_at) FROM application_events e WHERE e.application_id = a.id AND e.kind = 'status') AS first_move
         FROM applications a WHERE ${within("a.submitted_at", r, params)}
     )
     SELECT count(first_move)::int AS moved, count(*) FILTER (WHERE first_move IS NULL)::int AS waiting,
            avg(EXTRACT(EPOCH FROM (first_move - submitted_at)) / 3600.0) FILTER (WHERE first_move IS NOT NULL)::float8 AS avg_hours
       FROM x`,
    params,
  );
  return { moved: num(row?.moved), waiting: num(row?.waiting), avgHours: row?.avg_hours === null || row?.avg_hours === undefined ? null : Math.round(Number(row.avg_hours) * 10) / 10 };
}

/** Hires per recruiter by the date they were hired, for placements against targets. */
export async function hiresByRecruiter(r: Range) {
  const conn = await db();
  const params: unknown[] = [];
  return (
    await conn.query<{ key: string; label: string; hires: number }>(
      `SELECT COALESCE(a.assigned_to::text, 'none') AS key, COALESCE(min(u.name), 'Unassigned') AS label, count(*)::int AS hires
         FROM applications a LEFT JOIN admin_users u ON u.id = a.assigned_to
        WHERE a.status = 'hired' AND ${within(HIRED_AT, r, params)} GROUP BY 1 ORDER BY hires DESC`,
      params,
    )
  ).map((x) => ({ ...x, hires: num(x.hires) }));
}

/** Interviews held (or booked) in the range, by outcome. */
export async function interviewStats(r: Range) {
  const conn = await db();
  const params: unknown[] = [];
  const [row] = await conn.query<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'completed')::int AS completed,
            count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
            count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            count(*) FILTER (WHERE status = 'no_show')::int AS no_show
       FROM interviews i WHERE ${within("i.scheduled_at", r, params)}`,
    params,
  );
  return { total: num(row?.total), completed: num(row?.completed), scheduled: num(row?.scheduled), cancelled: num(row?.cancelled), noShow: num(row?.no_show) };
}

/**
 * Skills asked for by openings that aren't closed, next to how many Talent
 * Bank profiles list each one. A wide gap is where to source.
 */
export async function skillDemand(limit = 15) {
  const conn = await db();
  const rows = await conn.query<{ skill: string; openings: number; candidates: number }>(
    `WITH s AS (
       SELECT lower(trim(sk)) AS key, min(trim(sk)) AS skill, count(DISTINCT o.id)::int AS openings
         FROM job_openings o, unnest(o.skills) AS sk WHERE o.status <> 'closed' AND trim(sk) <> '' GROUP BY 1
     )
     SELECT s.skill, s.openings,
            (SELECT count(*)::int FROM candidates c WHERE EXISTS (SELECT 1 FROM unnest(c.skills) cs WHERE lower(trim(cs)) = s.key)) AS candidates
       FROM s ORDER BY s.openings DESC, s.skill LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ skill: r.skill, openings: num(r.openings), candidates: num(r.candidates) }));
}

/** Applications per week in the range (IST weeks starting Monday), zero-filled; at most 26 weeks shown. */
export async function weeklyApplications(r: Range) {
  const conn = await db();
  const params: unknown[] = [];
  const range = within("a.submitted_at", r, params);
  const rows = await conn.query<{ week: string; count: number }>(
    `WITH bounds AS (
       SELECT date_trunc('week', COALESCE(${isDate(r.from) ? `$${params.push(r.from)}::date::timestamp` : `(SELECT min(submitted_at) AT TIME ZONE 'Asia/Kolkata' FROM applications)`}, now() AT TIME ZONE 'Asia/Kolkata')) AS lo,
              date_trunc('week', ${isDate(r.to) ? `$${params.push(r.to)}::date::timestamp` : `now() AT TIME ZONE 'Asia/Kolkata'`}) AS hi
     ), weeks AS (SELECT generate_series(GREATEST(lo, hi - interval '25 weeks'), hi, interval '1 week') AS w FROM bounds)
     SELECT to_char(weeks.w, 'YYYY-MM-DD') AS week,
            (SELECT count(*)::int FROM applications a WHERE ${range} AND date_trunc('week', a.submitted_at AT TIME ZONE 'Asia/Kolkata') = weeks.w) AS count
       FROM weeks ORDER BY weeks.w`,
    params,
  );
  return rows.map((w) => ({ week: w.week, count: num(w.count) }));
}

/** Everything on the analytics page in one go. Client figures only when allowed. */
export async function analytics(r: Range, { withClients }: { withClients: boolean }) {
  const [funnel, hire, firstAction, sources, openings, recruiters, recruiterHires, clients, interviews, skills, weekly] = await Promise.all([
    pipelineConversion({ from: r.from, to: r.to }),
    timeToHire(r),
    timeToFirstAction(r),
    bySource(r),
    byOpening(r),
    byRecruiter(r),
    hiresByRecruiter(r),
    withClients ? byClient(r) : Promise.resolve(null),
    interviewStats(r),
    skillDemand(),
    weeklyApplications(r),
  ]);
  return { funnel, hire, firstAction, sources, openings, recruiters, recruiterHires, clients, interviews, skills, weekly };
}
