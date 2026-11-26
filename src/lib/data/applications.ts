import "server-only";
import { createHash } from "node:crypto";
import { notify } from "./notifications";
import { db } from "@/lib/db/client";
import { normaliseEmail } from "@/lib/auth/session";
import { ACTIVE_SHORTLIST, APPLICATION_SOURCES, APPLICATION_STATUSES, FUNNEL_STAGES, canMoveApplication, type ApplicationSource, type ApplicationStatus } from "./constants";
import { isIsoDate } from "@/lib/dates";

/* ------------------------------------------------------------------ */
/* Saving submissions from the website                                  */
/* ------------------------------------------------------------------ */

export type CandidateInput = {
  email: string;
  fullName: string;
  phone?: string;
  location?: string;
  preferredLocation?: string;
  specialisation?: string;
  experience?: string;
  employmentType?: string;
};

export type ResumeRef = { path: string; name: string; size: number; type: string };

export class OpeningClosedError extends Error {}

/**
 * Saves a submission from the website in one statement: the candidate (one
 * per email) and the application, so neither can be saved without the other.
 *
 * - A public form never changes what is already on a profile. It only fills
 *   fields that are empty; a different name or phone is kept on the
 *   application ("as submitted") for the recruiter to check.
 * - `submissionKey` makes a retry or double submit return the first
 *   application instead of creating a second one.
 * - An application to a job opening is only saved while the opening is still
 *   published and not past its closing date, checked in the same statement.
 */
export async function recordApplication(input: {
  candidate: CandidateInput;
  openingId?: string | null;
  source: ApplicationSource;
  position: string;
  experience: string;
  message?: string;
  details?: Record<string, unknown>;
  resume?: ResumeRef | null;
  /** Text read from the resume, for search and matching. */
  resumeText?: { status: "ok" | "empty" | "failed"; text: string } | null;
  /** One per form submission (the form sends it); a repeat returns the first save. */
  submissionKey?: string | null;
}) {
  const conn = await db();
  const c = input.candidate;
  const email = normaliseEmail(c.email);
  const opening = input.openingId ?? null;
  const key =
    input.submissionKey && /^[0-9a-f-]{36}$/i.test(input.submissionKey)
      ? `form:${input.submissionKey.toLowerCase()}`
      : // Without a key from the form, the same person, role and opening within the same 10 minutes count as one.
        `auto:${createHash("sha256").update(`${email}|${opening ?? ""}|${input.position.trim().toLowerCase()}|${Math.floor(Date.now() / 600_000)}`).digest("hex")}`;
  const [row] = await conn.query<{ id: string | null; number: string | null; assigned_to: string | null; candidate_id: string; applications: number }>(
    `WITH cand AS (
       INSERT INTO candidates (email, full_name, phone, location, preferred_location, specialisation, experience, employment_type)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8
        -- A closed opening takes nothing, not even a new profile.
        WHERE $9::uuid IS NULL
           OR EXISTS (SELECT 1 FROM job_openings o WHERE o.id = $9::uuid AND o.status = 'published'
                       AND (o.closing_date IS NULL OR o.closing_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date))
       ON CONFLICT (email) DO UPDATE SET
         full_name = COALESCE(NULLIF(candidates.full_name, ''), EXCLUDED.full_name),
         phone = COALESCE(NULLIF(candidates.phone, ''), EXCLUDED.phone),
         location = COALESCE(NULLIF(candidates.location, ''), EXCLUDED.location),
         preferred_location = COALESCE(NULLIF(candidates.preferred_location, ''), EXCLUDED.preferred_location),
         specialisation = COALESCE(NULLIF(candidates.specialisation, ''), EXCLUDED.specialisation),
         experience = COALESCE(NULLIF(candidates.experience, ''), EXCLUDED.experience),
         employment_type = COALESCE(NULLIF(candidates.employment_type, ''), EXCLUDED.employment_type),
         updated_at = now()
       RETURNING id, full_name, phone
     ),
     app AS (
       INSERT INTO applications (candidate_id, opening_id, source, position, experience, message, details, resume_path, resume_name, resume_size, resume_type, resume_text, resume_text_status, assigned_to, submission_key)
       SELECT cand.id, $9::uuid, $10, $11, $12, $13,
              $14::jsonb || jsonb_strip_nulls(jsonb_build_object(
                'submittedName', CASE WHEN lower(trim(cand.full_name)) <> lower(trim($2)) THEN $2 END,
                'submittedPhone', CASE WHEN $3 <> '' AND regexp_replace(cand.phone, '\\D', '', 'g') <> regexp_replace($3, '\\D', '', 'g') THEN $3 END)),
              $15, $16, $17, $18, $19, $20,
              -- A job with exactly one assigned recruiter hands the application straight to them.
              (SELECT min(r.user_id::text)::uuid FROM opening_recruiters r WHERE r.opening_id = $9::uuid HAVING count(*) = 1),
              $21
         FROM cand
       ON CONFLICT (submission_key) DO NOTHING
       RETURNING id, number, assigned_to
     )
     SELECT app.id, app.number::text, app.assigned_to, cand.id AS candidate_id,
            (SELECT count(*)::int FROM applications x WHERE x.candidate_id = cand.id) AS applications
       FROM cand LEFT JOIN app ON true`,
    [
      email,
      c.fullName,
      c.phone ?? "",
      c.location ?? "",
      c.preferredLocation ?? "",
      c.specialisation ?? "",
      c.experience ?? "",
      c.employmentType ?? "",
      opening,
      input.source,
      input.position,
      input.experience,
      input.message ?? "",
      JSON.stringify(input.details ?? {}),
      input.resume?.path ?? null,
      input.resume?.name ?? null,
      input.resume?.size ?? null,
      input.resume?.type ?? null,
      input.resume && input.resumeText ? input.resumeText.text : "",
      input.resume && input.resumeText ? input.resumeText.status : null,
      key,
    ],
  );
  if (!row?.id) {
    // Nothing inserted: either this submission was already saved, or the opening closed.
    const [first] = await conn.query<{ id: string; number: string; candidate_id: string; reference: string | null; applications: number }>(
      `SELECT a.id, a.number::text, a.candidate_id, a.details->>'reference' AS reference,
              (SELECT count(*)::int FROM applications x WHERE x.candidate_id = a.candidate_id) AS applications
         FROM applications a WHERE a.submission_key = $1`,
      [key],
    );
    if (first) return { id: first.id, number: Number(first.number), candidateId: first.candidate_id, repeat: Number(first.applications) > 1, duplicate: true, reference: first.reference };
    throw new OpeningClosedError("This opening is no longer accepting applications.");
  }
  // The count was taken in the same snapshot, before this application.
  const repeat = Number(row.applications) >= 1;
  if (row.assigned_to) await notify([row.assigned_to], null, "application", `New application from ${c.fullName} for ${input.position}`, `/admin/applications/${row.id}`);
  return { id: row.id, number: Number(row.number), candidateId: row.candidate_id, repeat, duplicate: false, reference: null as string | null };
}

/* ------------------------------------------------------------------ */
/* Admin: listing and filters                                           */
/* ------------------------------------------------------------------ */

export type ApplicationFilters = {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  opening?: string;
  client?: string;
  source?: string;
  candidate?: string;
  /** A recruiter's id, or "none" for unassigned. */
  assigned?: string;
  /** Only these applications (a bulk selection). An empty list matches nothing. */
  ids?: string[];
};

export type ApplicationRow = {
  id: string;
  number: string;
  source: ApplicationSource;
  position: string;
  experience: string;
  message: string;
  details: Record<string, unknown>;
  status: ApplicationStatus;
  resume_path: string | null;
  resume_name: string | null;
  resume_size: number | null;
  submitted_at: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  specialisation: string;
  opening_id: string | null;
  opening_title: string | null;
  opening_location: string | null;
  opening_work_mode: string | null;
  client_name: string | null;
  public_client_label: string | null;
  candidate_applications: number;
  assigned_to: string | null;
  assigned_name: string | null;
  stage_changed_at: string;
  priority: string;
  tags: string[];
};

const isDate = (v?: string | null) => isIsoDate(v);
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

function whereClause(f: ApplicationFilters) {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, value: unknown) => {
    params.push(value);
    where.push(sql(params.length));
  };
  if (f.q?.trim()) {
    const term = f.q.trim().slice(0, 100);
    params.push(`%${term}%`, term.replace(/^#/, ""));
    const n = params.length - 1;
    where.push(
      `(c.full_name ILIKE $${n} OR c.email ILIKE $${n} OR c.phone ILIKE $${n} OR a.position ILIKE $${n} OR c.specialisation ILIKE $${n} OR a.message ILIKE $${n} OR a.details::text ILIKE $${n} OR o.title ILIKE $${n} OR CAST(a.number AS text) = $${n + 1})`,
    );
  }
  if (isDate(f.from)) add((n) => `a.submitted_at >= ($${n}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`, f.from);
  if (isDate(f.to)) add((n) => `a.submitted_at < (($${n}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`, f.to);
  if (f.status && (APPLICATION_STATUSES as readonly string[]).includes(f.status)) add((n) => `a.status = $${n}`, f.status);
  if (f.source && (APPLICATION_SOURCES as readonly string[]).includes(f.source)) add((n) => `a.source = $${n}`, f.source);
  if (f.opening === "none") where.push(`a.opening_id IS NULL`);
  else if (isUuid(f.opening)) add((n) => `a.opening_id = $${n}`, f.opening);
  if (f.client?.trim()) add((n) => `o.client_name = $${n}`, f.client.trim());
  if (isUuid(f.candidate)) add((n) => `a.candidate_id = $${n}`, f.candidate);
  if (f.assigned === "none") where.push(`a.assigned_to IS NULL`);
  else if (isUuid(f.assigned)) add((n) => `a.assigned_to = $${n}`, f.assigned);
  if (f.ids) {
    const ids = [...new Set(f.ids.filter((v) => isUuid(v)))].slice(0, 500);
    if (ids.length) add((n) => `a.id = ANY($${n}::uuid[])`, ids);
    else where.push("false");
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const FROM = `FROM applications a JOIN candidates c ON c.id = a.candidate_id LEFT JOIN job_openings o ON o.id = a.opening_id LEFT JOIN admin_users ru ON ru.id = a.assigned_to`;
const SELECT = `SELECT a.id, a.number, a.source, a.position, a.experience, a.message, a.details, a.status, a.resume_path, a.resume_name, a.resume_size, a.submitted_at,
  c.id AS candidate_id, c.full_name, c.email, c.phone, c.location, c.specialisation,
  o.id AS opening_id, o.title AS opening_title, o.location AS opening_location, o.work_mode AS opening_work_mode, o.client_name, o.public_client_label,
  (SELECT count(*)::int FROM applications x WHERE x.candidate_id = c.id) AS candidate_applications,
  a.assigned_to, ru.name AS assigned_name, a.stage_changed_at, c.priority, c.tags`;

export async function listApplications(f: ApplicationFilters, { page = 1, pageSize = 25 }: { page?: number; pageSize?: number } = {}) {
  const conn = await db();
  const { sql, params } = whereClause(f);
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = await conn.query<ApplicationRow>(`${SELECT} ${FROM} ${sql} ORDER BY a.submitted_at DESC LIMIT ${pageSize} OFFSET ${offset}`, params);
  const [stats] = await conn.query<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE a.status = 'new')::int AS new,
            count(*) FILTER (WHERE a.status = 'screening')::int AS screening,
            count(*) FILTER (WHERE a.status IN (${ACTIVE_SHORTLIST.map((x) => `'${x}'`).join(",")}))::int AS shortlisted,
            count(*) FILTER (WHERE a.status = 'hired')::int AS hired,
            count(*) FILTER (WHERE a.resume_path IS NOT NULL)::int AS resumes
       ${FROM} ${sql}`,
    params,
  );
  return { rows, stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v)])) as Record<string, number> };
}

/** Rows for CSV export (no paging, capped for safety). */
export async function exportApplications(f: ApplicationFilters) {
  const conn = await db();
  const { sql, params } = whereClause(f);
  return conn.query<ApplicationRow>(`${SELECT} ${FROM} ${sql} ORDER BY a.submitted_at DESC LIMIT 10000`, params);
}

export async function clientNames() {
  const conn = await db();
  const rows = await conn.query<{ client_name: string }>(`SELECT DISTINCT client_name FROM job_openings WHERE client_name <> '' ORDER BY client_name`);
  return rows.map((r) => r.client_name);
}

export async function openingOptions() {
  const conn = await db();
  return conn.query<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM job_openings ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, title`,
  );
}

/* ------------------------------------------------------------------ */
/* Admin: one application                                               */
/* ------------------------------------------------------------------ */

export type ApplicationEvent = {
  id: string;
  kind: "note" | "status" | "assign" | "edit" | "email" | "interview" | "task" | "merge";
  body: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user_name: string | null;
};

export async function getApplication(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<ApplicationRow & { preferred_location: string; employment_type: string; candidate_experience: string }>(
    `${SELECT}, c.preferred_location, c.employment_type, c.experience AS candidate_experience ${FROM} WHERE a.id = $1`,
    [id],
  );
  if (!row) return null;
  const events = await conn.query<ApplicationEvent>(
    `SELECT e.id, e.kind, e.body, e.from_status, e.to_status, e.details, e.created_at, u.name AS user_name
       FROM application_events e LEFT JOIN admin_users u ON u.id = e.user_id WHERE e.application_id = $1 ORDER BY e.created_at DESC`,
    [id],
  );
  const others = await conn.query<{ id: string; number: string; position: string; status: ApplicationStatus; submitted_at: string }>(
    `SELECT id, number, position, status, submitted_at FROM applications WHERE candidate_id = $1 AND id <> $2 ORDER BY submitted_at DESC`,
    [row.candidate_id, id],
  );
  return { ...row, events, others };
}

/** Moves an application to a stage and records it on the candidate's timeline. False when nothing changed. */
/**
 * Moves one application to a stage. False when it is already there, the move
 * isn't allowed from its current stage (see canMoveApplication), or someone
 * else moved it first.
 */
export async function setApplicationStatus(id: string, status: ApplicationStatus, userId: string, { superAdmin = false }: { superAdmin?: boolean } = {}) {
  if (!isUuid(id) || !APPLICATION_STATUSES.includes(status)) return false;
  const conn = await db();
  const [prev] = await conn.query<{ status: ApplicationStatus; candidate_id: string }>(`SELECT status, candidate_id FROM applications WHERE id = $1`, [id]);
  if (!prev || !canMoveApplication(prev.status, status, superAdmin)) return false;
  const [moved] = await conn.tx([
    {
      // Guarded on the old status so two people moving the same card can't both win.
      text: `UPDATE applications SET status = $2, stage_changed_at = now(), updated_at = now(),
               hired_at = CASE WHEN $2 = 'hired' THEN COALESCE(hired_at, now()) ELSE hired_at END
             WHERE id = $1 AND status = $3 RETURNING id`,
      params: [id, status, prev.status],
    },
    {
      text: `INSERT INTO application_events (application_id, candidate_id, user_id, kind, from_status, to_status)
             SELECT $1, $2, $3, 'status', $4, $5 WHERE EXISTS (SELECT 1 FROM applications WHERE id = $1 AND status = $5)`,
      params: [id, prev.candidate_id, userId, prev.status, status],
    },
  ]);
  return moved.length > 0;
}

/** Assigns (or unassigns, with null) the recruiter who owns this application. */
export async function assignApplication(id: string, assignee: string | null, userId: string) {
  if (!isUuid(id) || (assignee !== null && !isUuid(assignee))) return false;
  const conn = await db();
  const [prev] = await conn.query<{ assigned_to: string | null; candidate_id: string }>(`SELECT assigned_to, candidate_id FROM applications WHERE id = $1`, [id]);
  if (!prev || prev.assigned_to === assignee) return false;
  await conn.tx([
    { text: `UPDATE applications SET assigned_to = $2, updated_at = now() WHERE id = $1`, params: [id, assignee] },
    {
      text: `INSERT INTO application_events (application_id, candidate_id, user_id, kind, body, details)
             VALUES ($1, $2, $3, 'assign', COALESCE((SELECT name FROM admin_users WHERE id = $4::text::uuid), ''), jsonb_build_object('from', $5::text, 'to', $4::text))`,
      params: [id, prev.candidate_id, userId, assignee, prev.assigned_to],
    },
  ]);
  return true;
}

export async function addApplicationNote(id: string, body: string, userId: string) {
  const conn = await db();
  await conn.query(
    `INSERT INTO application_events (application_id, candidate_id, user_id, kind, body)
     SELECT id, candidate_id, $2, 'note', $3 FROM applications WHERE id = $1`,
    [id, userId, body.slice(0, 4000)],
  );
}

export async function deleteApplication(id: string) {
  const conn = await db();
  // Hired applications are business records and are kept.
  const [row] = await conn.query<{ resume_path: string | null; candidate_id: string }>(`DELETE FROM applications WHERE id = $1 AND status <> 'hired' RETURNING resume_path, candidate_id`, [id]);
  // A candidate whose only application was deleted goes too (data-deletion requests),
  // unless the team stored resumes on the profile itself.
  if (row)
    await conn.query(
      `DELETE FROM candidates c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM candidate_files f WHERE f.candidate_id = c.id)`,
      [row.candidate_id],
    );
  return row?.resume_path ?? null;
}

export async function getResumeRef(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ resume_path: string | null; resume_name: string | null; resume_type: string | null; full_name: string; number: string }>(
    `SELECT a.resume_path, a.resume_name, a.resume_type, c.full_name, a.number FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE a.id = $1`,
    [id],
  );
  return row?.resume_path ? row : null;
}

/* ------------------------------------------------------------------ */
/* Talent Bank                                                          */
/* ------------------------------------------------------------------ */

export type TalentFilters = { q?: string; specialisation?: string; experience?: string; employmentType?: string; location?: string };

export type TalentRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  preferred_location: string;
  specialisation: string;
  experience: string;
  employment_type: string;
  updated_at: string;
  applications: number;
  latest_application_id: string | null;
  latest_status: ApplicationStatus | null;
  latest_position: string | null;
  has_resume: boolean;
};

export async function listTalent(f: TalentFilters, { page = 1, pageSize = 25 }: { page?: number; pageSize?: number } = {}) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (f.q?.trim()) add((n) => `(c.full_name ILIKE $${n} OR c.email ILIKE $${n} OR c.phone ILIKE $${n} OR c.specialisation ILIKE $${n} OR c.location ILIKE $${n})`, `%${f.q.trim().slice(0, 100)}%`);
  if (f.specialisation) add((n) => `c.specialisation = $${n}`, f.specialisation);
  if (f.experience) add((n) => `c.experience = $${n}`, f.experience);
  if (f.employmentType) add((n) => `c.employment_type = $${n}`, f.employmentType);
  if (f.location?.trim()) add((n) => `(c.location ILIKE $${n} OR c.preferred_location ILIKE $${n})`, `%${f.location.trim().slice(0, 80)}%`);
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = await conn.query<TalentRow>(
    `SELECT c.id, c.full_name, c.email, c.phone, c.location, c.preferred_location, c.specialisation, c.experience, c.employment_type, c.updated_at,
            (SELECT count(*)::int FROM applications a WHERE a.candidate_id = c.id) AS applications,
            l.id AS latest_application_id, l.status AS latest_status, l.position AS latest_position,
            EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.resume_path IS NOT NULL) AS has_resume
       FROM candidates c
       LEFT JOIN LATERAL (SELECT id, status, position FROM applications a WHERE a.candidate_id = c.id ORDER BY submitted_at DESC LIMIT 1) l ON true
       ${sql} ORDER BY c.updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM candidates c ${sql}`, params);
  return { rows, total: Number(count) };
}

export async function talentFacets() {
  const conn = await db();
  const spec = await conn.query<{ v: string }>(`SELECT DISTINCT specialisation AS v FROM candidates WHERE specialisation <> '' ORDER BY 1`);
  const exp = await conn.query<{ v: string }>(`SELECT DISTINCT experience AS v FROM candidates WHERE experience <> '' ORDER BY 1`);
  const emp = await conn.query<{ v: string }>(`SELECT DISTINCT employment_type AS v FROM candidates WHERE employment_type <> '' ORDER BY 1`);
  return { specialisations: spec.map((r) => r.v), experiences: exp.map((r) => r.v), employmentTypes: emp.map((r) => r.v) };
}

/* ------------------------------------------------------------------ */
/* Pipeline (Kanban)                                                    */
/* ------------------------------------------------------------------ */

export type PipelineCard = {
  id: string;
  number: string;
  status: ApplicationStatus;
  position: string;
  stage_changed_at: string;
  submitted_at: string;
  candidate_id: string;
  full_name: string;
  priority: string;
  opening_title: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  has_resume: boolean;
};

const PIPELINE_LIMIT = 600;

/** Cards for the board, newest movement first within each stage. */
export async function listPipeline(f: ApplicationFilters) {
  const conn = await db();
  const { sql, params } = whereClause(f);
  const rows = await conn.query<PipelineCard>(
    `SELECT a.id, a.number, a.status, a.position, a.stage_changed_at, a.submitted_at, c.id AS candidate_id, c.full_name, c.priority,
            o.title AS opening_title, a.assigned_to, ru.name AS assigned_name, (a.resume_path IS NOT NULL) AS has_resume
       ${FROM} ${sql} ORDER BY a.stage_changed_at DESC LIMIT ${PIPELINE_LIMIT + 1}`,
    params,
  );
  return { cards: rows.slice(0, PIPELINE_LIMIT), truncated: rows.length > PIPELINE_LIMIT };
}

const FUNNEL_ARRAY = `ARRAY[${FUNNEL_STAGES.map((x) => `'${x}'`).join(",")}]::text[]`;

/**
 * Conversion through the pipeline: for each forward stage, how many
 * applications reached it or went further (from the current stage and the
 * status history, so a rejection after an interview still counts the interview).
 */
export async function pipelineConversion(f: ApplicationFilters) {
  const conn = await db();
  const { sql, params } = whereClause(f);
  const [row] = await conn.query<Record<string, number>>(
    `WITH reached AS (
       SELECT a.status, GREATEST(
           COALESCE(array_position(${FUNNEL_ARRAY}, a.status), 1),
           COALESCE((SELECT max(array_position(${FUNNEL_ARRAY}, e.to_status)) FROM application_events e WHERE e.application_id = a.id AND e.kind = 'status'), 1)
         ) AS rank
       ${FROM} ${sql})
     SELECT count(*)::int AS total,
            ${FUNNEL_STAGES.map((st, i) => `count(*) FILTER (WHERE rank >= ${i + 1})::int AS "${st}"`).join(", ")},
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
            count(*) FILTER (WHERE status = 'on_hold')::int AS on_hold
       FROM reached`,
    params,
  );
  const n = (k: string) => Number(row?.[k] ?? 0);
  return {
    total: n("total"),
    rejected: n("rejected"),
    onHold: n("on_hold"),
    stages: FUNNEL_STAGES.map((stage, i) => {
      const count = n(stage);
      const prev = i === 0 ? count : n(FUNNEL_STAGES[i - 1]);
      return { stage, count, ofPrevious: prev ? count / prev : 0, ofTotal: n("total") ? count / n("total") : 0 };
    }),
  };
}

/** Admins who can own candidates and applications. */
export async function recruiterOptions() {
  const conn = await db();
  return conn.query<{ id: string; name: string; role: string }>(
    `SELECT id, name, role FROM admin_users WHERE active AND role IN ('super_admin','recruiter') ORDER BY name`,
  );
}
