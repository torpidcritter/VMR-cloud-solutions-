import "server-only";
import { db } from "@/lib/db/client";
import { APPLICATION_STATUSES, canMoveApplication, type ApplicationStatus } from "./constants";
import { exportApplications, type ApplicationFilters } from "./applications";
import { isIsoDate } from "@/lib/dates";

/**
 * Changes to many applications at once. Each operation is a single SQL
 * statement, so it applies to every selected row or to none, and every
 * change is written to the candidates' timelines in the same statement.
 */

export const BULK_LIMIT = 500;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const clean = (ids: string[]) => [...new Set(ids.filter(isUuid))].slice(0, BULK_LIMIT);

/** Ids of the applications matching the filters, newest first, capped. */
export async function applicationIdsMatching(f: ApplicationFilters, cap = BULK_LIMIT) {
  return (await exportApplications(f)).slice(0, cap).map((r) => r.id);
}

/**
 * Moves applications to a stage. Those already there, or that may not move
 * there from where they are (see canMoveApplication), are left alone.
 * Returns how many moved.
 */
export async function bulkSetStatus(ids: string[], status: ApplicationStatus, userId: string, { superAdmin = false }: { superAdmin?: boolean } = {}) {
  const list = clean(ids);
  if (!list.length || !APPLICATION_STATUSES.includes(status)) return 0;
  const from = APPLICATION_STATUSES.filter((f) => canMoveApplication(f, status, superAdmin));
  if (!from.length) return 0;
  const conn = await db();
  const [row] = await conn.query<{ n: number }>(
    `WITH prev AS (SELECT id, candidate_id, status FROM applications WHERE id = ANY($1::uuid[]) AND status = ANY($4::text[]) FOR UPDATE),
     moved AS (
       UPDATE applications a SET status = $2, stage_changed_at = now(), updated_at = now(),
              hired_at = CASE WHEN $2 = 'hired' THEN COALESCE(a.hired_at, now()) ELSE a.hired_at END
         FROM prev WHERE a.id = prev.id RETURNING a.id
     ),
     ev AS (
       INSERT INTO application_events (application_id, candidate_id, user_id, kind, from_status, to_status, details)
       SELECT id, candidate_id, $3, 'status', status, $2, '{"bulk": true}'::jsonb FROM prev
     )
     SELECT count(*)::int AS n FROM moved`,
    [list, status, userId, from],
  );
  return Number(row.n);
}

/** Assigns (or, with null, unassigns) applications. Only active Super Admins and Recruiters can be given them. */
export async function bulkAssign(ids: string[], assignee: string | null, userId: string) {
  const list = clean(ids);
  if (!list.length || (assignee !== null && !isUuid(assignee))) return 0;
  const conn = await db();
  if (assignee) {
    const [ok] = await conn.query<{ id: string }>(`SELECT id FROM admin_users WHERE id = $1 AND active AND role IN ('super_admin','recruiter')`, [assignee]);
    if (!ok) return 0;
  }
  const [row] = await conn.query<{ n: number }>(
    `WITH prev AS (SELECT id, candidate_id, assigned_to FROM applications WHERE id = ANY($1::uuid[]) AND assigned_to IS DISTINCT FROM $2::uuid FOR UPDATE),
     done AS (UPDATE applications a SET assigned_to = $2::uuid, updated_at = now() FROM prev WHERE a.id = prev.id RETURNING a.id),
     ev AS (
       INSERT INTO application_events (application_id, candidate_id, user_id, kind, body, details)
       SELECT id, candidate_id, $3, 'assign', COALESCE((SELECT name FROM admin_users WHERE id = $2::uuid), ''),
              jsonb_build_object('from', assigned_to::text, 'to', $2::text, 'bulk', true)
         FROM prev
     )
     SELECT count(*)::int AS n FROM done`,
    [list, assignee, userId],
  );
  return Number(row.n);
}

/** Adds a tag to the candidates behind these applications (each candidate once; at most 20 tags each). */
export async function bulkTagCandidates(ids: string[], tag: string, userId: string) {
  const list = clean(ids);
  const t = tag.trim().slice(0, 40);
  if (!list.length || !t) return 0;
  const conn = await db();
  const [row] = await conn.query<{ n: number }>(
    `WITH prev AS (
       SELECT c.id, c.tags FROM candidates c
        WHERE c.id IN (SELECT candidate_id FROM applications WHERE id = ANY($1::uuid[]))
          AND NOT EXISTS (SELECT 1 FROM unnest(c.tags) x WHERE lower(x) = lower($2)) AND cardinality(c.tags) < 20
        FOR UPDATE
     ),
     done AS (UPDATE candidates c SET tags = prev.tags || ARRAY[$2::text], updated_at = now() FROM prev WHERE c.id = prev.id RETURNING c.id, c.tags),
     ev AS (
       INSERT INTO application_events (candidate_id, user_id, kind, body, details)
       SELECT prev.id, $3, 'edit', 'Tags', jsonb_build_object('changes', jsonb_build_object('Tags', jsonb_build_array(to_jsonb(prev.tags), to_jsonb(prev.tags || ARRAY[$2::text]))), 'bulk', true)
         FROM prev
     )
     SELECT count(*)::int AS n FROM done`,
    [list, t, userId],
  );
  return Number(row.n);
}

/** Sets (or clears, with null) the follow-up date on the candidates behind these applications. */
export async function bulkFollowUp(ids: string[], date: string | null, userId: string) {
  const list = clean(ids);
  if (!list.length || (date !== null && !isIsoDate(date))) return 0;
  const conn = await db();
  const [row] = await conn.query<{ n: number }>(
    `WITH prev AS (
       SELECT c.id, to_char(c.follow_up_on, 'YYYY-MM-DD') AS old FROM candidates c
        WHERE c.id IN (SELECT candidate_id FROM applications WHERE id = ANY($1::uuid[])) AND c.follow_up_on IS DISTINCT FROM $2::date
        FOR UPDATE
     ),
     done AS (UPDATE candidates c SET follow_up_on = $2::date, updated_at = now() FROM prev WHERE c.id = prev.id RETURNING c.id),
     ev AS (
       INSERT INTO application_events (candidate_id, user_id, kind, body, details)
       SELECT id, $3, 'edit', 'Follow-up', jsonb_build_object('changes', jsonb_build_object('Follow-up', jsonb_build_array(old, $2::text)), 'bulk', true) FROM prev
     )
     SELECT count(*)::int AS n FROM done`,
    [list, date, userId],
  );
  return Number(row.n);
}

/** Stored resumes for a set of applications, for the ZIP download. */
export async function resumeRefs(ids: string[]) {
  const list = clean(ids);
  if (!list.length) return [];
  const conn = await db();
  return conn.query<{ id: string; number: string; full_name: string; resume_path: string }>(
    `SELECT a.id, a.number::text, c.full_name, a.resume_path FROM applications a JOIN candidates c ON c.id = a.candidate_id
      WHERE a.id = ANY($1::uuid[]) AND a.resume_path IS NOT NULL ORDER BY a.number`,
    [list],
  );
}
