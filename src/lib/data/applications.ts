import "server-only";
import { db } from "@/lib/db/client";
import { normaliseEmail } from "@/lib/auth/session";
import { ACTIVE_SHORTLIST, APPLICATION_SOURCES, APPLICATION_STATUSES, FUNNEL_STAGES, type ApplicationSource, type ApplicationStatus } from "./constants";

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

export async function recordApplication(input: {
  candidate: CandidateInput;
  openingId?: string | null;
  source: ApplicationSource;
  position: string;
  experience: string;
  message?: string;
  details?: Record<string, unknown>;
  resume?: ResumeRef | null;
}) {
  const conn = await db();
  const c = input.candidate;
  // One candidate per email; newer non-empty details win.
  const [cand] = await conn.query<{ id: string }>(
    `INSERT INTO candidates (email, full_name, phone, location, preferred_location, specialisation, experience, employment_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       phone = COALESCE(NULLIF(EXCLUDED.phone, ''), candidates.phone),
       location = COALESCE(NULLIF(EXCLUDED.location, ''), candidates.location),
       preferred_location = COALESCE(NULLIF(EXCLUDED.preferred_location, ''), candidates.preferred_location),
       specialisation = COALESCE(NULLIF(EXCLUDED.specialisation, ''), candidates.specialisation),
       experience = COALESCE(NULLIF(EXCLUDED.experience, ''), candidates.experience),
       employment_type = COALESCE(NULLIF(EXCLUDED.employment_type, ''), candidates.employment_type),
       updated_at = now()
     RETURNING id`,
    [
      normaliseEmail(c.email),
      c.fullName,
      c.phone ?? "",
      c.location ?? "",
      c.preferredLocation ?? "",
      c.specialisation ?? "",
      c.experience ?? "",
      c.employmentType ?? "",
    ],
  );
  const [app] = await conn.query<{ id: string; number: string }>(
    // A job with exactly one assigned recruiter hands the application straight to them.
    `INSERT INTO applications (candidate_id, opening_id, source, position, experience, message, details, resume_path, resume_name, resume_size, resume_type, assigned_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,
       (SELECT min(r.user_id::text)::uuid FROM opening_recruiters r WHERE r.opening_id = $2::uuid HAVING count(*) = 1))
     RETURNING id, number`,
    [
      cand.id,
      input.openingId ?? null,
      input.source,
      input.position,
      input.experience,
      input.message ?? "",
      JSON.stringify(input.details ?? {}),
      input.resume?.path ?? null,
      input.resume?.name ?? null,
      input.resume?.size ?? null,
      input.resume?.type ?? null,
    ],
  );
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM applications WHERE candidate_id = $1`, [cand.id]);
  return { id: app.id, number: Number(app.number), candidateId: cand.id, repeat: Number(count) > 1 };
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

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
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
export async function setApplicationStatus(id: string, status: ApplicationStatus, userId: string) {
  if (!isUuid(id) || !APPLICATION_STATUSES.includes(status)) return false;
  const conn = await db();
  const [prev] = await conn.query<{ status: string; candidate_id: string }>(`SELECT status, candidate_id FROM applications WHERE id = $1`, [id]);
  if (!prev || prev.status === status) return false;
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
  const [row] = await conn.query<{ resume_path: string | null; candidate_id: string }>(`DELETE FROM applications WHERE id = $1 RETURNING resume_path, candidate_id`, [id]);
  // A candidate whose only application was deleted goes too (data-deletion requests).
  if (row) await conn.query(`DELETE FROM candidates c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id)`, [row.candidate_id]);
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
