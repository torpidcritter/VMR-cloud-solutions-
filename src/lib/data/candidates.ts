import "server-only";
import { pgTermRegex, termPattern } from "@/lib/matching";
import { db, type Statement } from "@/lib/db/client";
import { APPLICATION_STATUSES, AVAILABILITY_OPTIONS, CANDIDATE_PRIORITIES, type ApplicationStatus, type CandidatePriority } from "./constants";
import { isIsoDate } from "@/lib/dates";

/**
 * One central profile per candidate (matched by email). Applications, notes,
 * status changes and edits all hang off it and form its timeline.
 */

const isUuid = (v?: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const isDate = (v?: string | null) => isIsoDate(v);

export type Candidate = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  location: string;
  preferred_location: string;
  specialisation: string;
  experience: string;
  employment_type: string;
  tags: string[];
  skills: string[];
  qualifications: string;
  experience_years: number | null;
  current_title: string;
  current_company: string;
  notice_period: string;
  priority: CandidatePriority;
  owner_id: string | null;
  owner_name: string | null;
  follow_up_on: string | null;
  availability: string;
  last_contacted_at: string | null;
  linkedin_url: string;
  summary: string;
  created_at: string;
  updated_at: string;
  /** Goes up by one each time a profile field changes; the edit form sends it back. */
  version: number;
};

const COLS = `c.id, c.email, c.full_name, c.phone, c.location, c.preferred_location, c.specialisation, c.experience, c.employment_type,
  c.tags, c.skills, c.qualifications, c.experience_years::float8 AS experience_years, c.current_title, c.current_company, c.notice_period,
  c.priority, c.owner_id, ow.name AS owner_name, to_char(c.follow_up_on, 'YYYY-MM-DD') AS follow_up_on, c.availability,
  c.last_contacted_at, c.linkedin_url, c.summary, c.created_at, c.updated_at, c.version`;

export type TimelineEntry = {
  id: string;
  kind: string;
  body: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_name: string | null;
  application_id: string | null;
  application_number: string | null;
  application_position: string | null;
};

export type CandidateApplication = {
  id: string;
  number: string;
  position: string;
  source: string;
  status: ApplicationStatus;
  submitted_at: string;
  stage_changed_at: string;
  opening_id: string | null;
  opening_title: string | null;
  assigned_name: string | null;
  has_resume: boolean;
};

export type DuplicateCandidate = { id: string; full_name: string; email: string; phone: string; reason: string; applications: number };

export async function getCandidate(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [c] = await conn.query<Candidate>(`SELECT ${COLS} FROM candidates c LEFT JOIN admin_users ow ON ow.id = c.owner_id WHERE c.id = $1`, [id]);
  if (!c) return null;
  const [applications, timeline, duplicates] = await Promise.all([
    conn.query<CandidateApplication>(
      `SELECT a.id, a.number, a.position, a.source, a.status, a.submitted_at, a.stage_changed_at, a.opening_id, o.title AS opening_title,
              ru.name AS assigned_name, (a.resume_path IS NOT NULL) AS has_resume
         FROM applications a LEFT JOIN job_openings o ON o.id = a.opening_id LEFT JOIN admin_users ru ON ru.id = a.assigned_to
        WHERE a.candidate_id = $1 ORDER BY a.submitted_at DESC`,
      [id],
    ),
    conn.query<TimelineEntry>(
      `SELECT e.id, e.kind, e.body, e.from_status, e.to_status, e.details, e.created_at, u.name AS user_name,
              e.application_id, a.number AS application_number, a.position AS application_position
         FROM application_events e LEFT JOIN admin_users u ON u.id = e.user_id LEFT JOIN applications a ON a.id = e.application_id
        WHERE e.candidate_id = $1 ORDER BY e.created_at DESC LIMIT 300`,
      [id],
    ),
    findDuplicates(c),
  ]);
  return { ...c, applications, timeline, duplicates };
}

const digits = (v: string) => v.replace(/\D/g, "").slice(-10);

/** Other profiles that look like the same person: same phone number, or same full name. */
export async function findDuplicates(c: Pick<Candidate, "id" | "phone" | "full_name">): Promise<DuplicateCandidate[]> {
  const conn = await db();
  const phone = digits(c.phone);
  return conn.query<DuplicateCandidate>(
    `SELECT d.id, d.full_name, d.email, d.phone,
            CASE WHEN $2 <> '' AND right(regexp_replace(d.phone, '\\D', '', 'g'), 10) = $2 THEN 'Same phone number' ELSE 'Same name' END AS reason,
            (SELECT count(*)::int FROM applications a WHERE a.candidate_id = d.id) AS applications
       FROM candidates d
      WHERE d.id <> $1
        AND (($2 <> '' AND length($2) >= 7 AND right(regexp_replace(d.phone, '\\D', '', 'g'), 10) = $2)
             OR lower(trim(d.full_name)) = lower(trim($3)))
      ORDER BY d.updated_at DESC LIMIT 10`,
    [c.id, phone, c.full_name],
  );
}

/* ------------------------------------------------------------------ */
/* Editing                                                              */
/* ------------------------------------------------------------------ */

export type CandidateInput = {
  full_name: string;
  phone: string;
  location: string;
  preferred_location: string;
  specialisation: string;
  current_title: string;
  current_company: string;
  experience_years: number | null;
  notice_period: string;
  availability: string;
  qualifications: string;
  skills: string[];
  tags: string[];
  linkedin_url: string;
  summary: string;
};

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Comma-separated words → a clean, de-duplicated list (case-insensitive). */
export function parseList(v: unknown, maxItems = 40, maxLen = 60) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of str(v, 4000).split(",")) {
    const item = raw.trim().replace(/\s+/g, " ").slice(0, maxLen);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function parseCandidate(form: Record<string, unknown>): { data: CandidateInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const yearsRaw = str(form.experience_years, 10);
  const years = yearsRaw === "" ? null : Number(yearsRaw);
  const data: CandidateInput = {
    full_name: str(form.full_name, 120),
    phone: str(form.phone, 30),
    location: str(form.location, 120),
    preferred_location: str(form.preferred_location, 120),
    specialisation: str(form.specialisation, 120),
    current_title: str(form.current_title, 160),
    current_company: str(form.current_company, 160),
    experience_years: years,
    notice_period: str(form.notice_period, 60),
    availability: str(form.availability, 60),
    qualifications: str(form.qualifications, 2000),
    skills: parseList(form.skills),
    tags: parseList(form.tags, 20, 40),
    linkedin_url: str(form.linkedin_url, 300),
    summary: str(form.summary, 4000),
  };
  if (data.full_name.length < 2) errors.full_name = "Enter the candidate's name.";
  if (data.phone && !/^[+()\-\s\d]{7,30}$/.test(data.phone)) errors.phone = "Enter a valid phone number.";
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > 60)) errors.experience_years = "Enter years between 0 and 60.";
  if (data.availability && !(AVAILABILITY_OPTIONS as readonly string[]).includes(data.availability)) errors.availability = "Choose from the list.";
  if (data.linkedin_url && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(data.linkedin_url)) errors.linkedin_url = "Use a https://linkedin.com/… link.";
  return { data, errors };
}

const LABELS: Record<keyof CandidateInput, string> = {
  full_name: "Name",
  phone: "Phone",
  location: "Location",
  preferred_location: "Preferred location",
  specialisation: "Specialisation",
  current_title: "Current title",
  current_company: "Current company",
  experience_years: "Experience (years)",
  notice_period: "Notice period",
  availability: "Availability",
  qualifications: "Qualifications",
  skills: "Skills",
  tags: "Tags",
  linkedin_url: "LinkedIn",
  summary: "Summary",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Saves the profile and records which fields changed (old and new values) on the timeline. */
export type UpdateResult = { changed: string[]; conflict?: undefined } | { conflict: { by: string | null; at: string | null }; changed?: undefined };

/**
 * Saves the profile form. `expectedVersion` is the version the form was
 * opened at: if someone else saved the profile since, nothing is written and
 * the caller is told who changed it, instead of the last save silently winning.
 */
export async function updateCandidate(id: string, input: CandidateInput, userId: string, { expectedVersion }: { expectedVersion?: number | null } = {}): Promise<UpdateResult | null> {
  const conn = await db();
  const [before] = await conn.query<Candidate>(`SELECT ${COLS} FROM candidates c LEFT JOIN admin_users ow ON ow.id = c.owner_id WHERE c.id = $1`, [id]);
  if (!before) return null;
  const expected = expectedVersion != null && Number.isInteger(expectedVersion) ? expectedVersion : null;
  const conflict = async () => {
    const [last] = await conn.query<{ by: string | null; at: string }>(
      `SELECT u.name AS by, e.created_at AS at FROM application_events e LEFT JOIN admin_users u ON u.id = e.user_id
        WHERE e.candidate_id = $1 AND e.kind = 'edit' ORDER BY e.created_at DESC LIMIT 1`,
      [id],
    );
    return { conflict: { by: last?.by ?? null, at: last?.at ?? null } };
  };
  if (expected !== null && Number(before.version) !== expected) return conflict();
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(LABELS) as (keyof CandidateInput)[]) {
    if (!same(before[k], input[k])) changes[LABELS[k]] = [before[k], input[k]];
  }
  if (!Object.keys(changes).length) return { changed: [] as string[] };
  // One statement: the edit event is only written if the update matched the version read above.
  const saved = await conn.query<{ ok: number }>(
    `WITH u AS (
       UPDATE candidates SET full_name=$2, phone=$3, location=$4, preferred_location=$5, specialisation=$6, current_title=$7, current_company=$8,
              experience_years=$9, notice_period=$10, availability=$11, qualifications=$12, skills=$13, tags=$14, linkedin_url=$15, summary=$16, updated_at=now()
        WHERE id = $1 AND version = $17
        RETURNING id
     )
     INSERT INTO application_events (candidate_id, user_id, kind, body, details)
     SELECT u.id, $18, 'edit', $19, $20::jsonb FROM u
     RETURNING 1 AS ok`,
    [
      id,
      input.full_name,
      input.phone,
      input.location,
      input.preferred_location,
      input.specialisation,
      input.current_title,
      input.current_company,
      input.experience_years,
      input.notice_period,
      input.availability,
      input.qualifications,
      input.skills,
      input.tags,
      input.linkedin_url,
      input.summary,
      Number(before.version),
      userId,
      Object.keys(changes).join(", ").slice(0, 500),
      JSON.stringify({ changes }),
    ],
  );
  if (!saved.length) return conflict();
  return { changed: Object.keys(changes) };
}

function editEvent(candidateId: string, userId: string, body: string, details: Record<string, unknown>): Statement {
  return {
    text: `INSERT INTO application_events (candidate_id, user_id, kind, body, details) VALUES ($1, $2, 'edit', $3, $4::jsonb)`,
    params: [candidateId, userId, body.slice(0, 500), JSON.stringify(details)],
  };
}

/** Quick changes from the profile header and bulk actions: priority, owner, follow-up date, tags. */
export async function setCandidateFields(
  id: string,
  fields: { priority?: string; owner_id?: string | null; follow_up_on?: string | null; addTags?: string[]; removeTags?: string[]; last_contacted?: boolean },
  userId: string,
) {
  if (!isUuid(id)) return false;
  const conn = await db();
  const [before] = await conn.query<Candidate>(`SELECT ${COLS} FROM candidates c LEFT JOIN admin_users ow ON ow.id = c.owner_id WHERE c.id = $1`, [id]);
  if (!before) return false;
  const sets: string[] = [];
  const params: unknown[] = [id];
  const changes: Record<string, [unknown, unknown]> = {};
  const set = (col: string, value: unknown, label: string, old: unknown, cast = "") => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
    changes[label] = [old, value];
  };
  if (fields.priority !== undefined && (CANDIDATE_PRIORITIES as readonly string[]).includes(fields.priority) && fields.priority !== before.priority)
    set("priority", fields.priority, "Priority", before.priority);
  if (fields.owner_id !== undefined && (fields.owner_id === null || isUuid(fields.owner_id)) && fields.owner_id !== before.owner_id)
    set("owner_id", fields.owner_id, "Owner", before.owner_name, "::uuid");
  if (fields.follow_up_on !== undefined && (fields.follow_up_on === null || isDate(fields.follow_up_on)) && fields.follow_up_on !== before.follow_up_on)
    set("follow_up_on", fields.follow_up_on, "Follow-up", before.follow_up_on, "::date");
  if (fields.addTags?.length || fields.removeTags?.length) {
    const drop = new Set((fields.removeTags ?? []).map((t) => t.toLowerCase()));
    const next = [...before.tags.filter((t) => !drop.has(t.toLowerCase()))];
    for (const t of fields.addTags ?? []) if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    if (!same(next, before.tags)) set("tags", next.slice(0, 20), "Tags", before.tags);
  }
  if (fields.last_contacted) {
    sets.push("last_contacted_at = now()");
    changes["Last contacted"] = [before.last_contacted_at, "now"];
  }
  if (!sets.length) return false;
  const label = Object.keys(changes).join(", ");
  // Owner changes show the new owner's name on the timeline.
  if (changes.Owner) {
    const [u] = fields.owner_id ? await conn.query<{ name: string }>(`SELECT name FROM admin_users WHERE id = $1`, [fields.owner_id]) : [];
    changes.Owner = [before.owner_name, u?.name ?? null];
  }
  await conn.tx([{ text: `UPDATE candidates SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params }, editEvent(id, userId, label, { changes })]);
  return true;
}

export async function addCandidateNote(id: string, body: string, userId: string, applicationId?: string | null) {
  const conn = await db();
  await conn.query(
    `INSERT INTO application_events (candidate_id, application_id, user_id, kind, body)
     SELECT c.id, $4::uuid, $2, 'note', $3 FROM candidates c WHERE c.id = $1
        AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM applications a WHERE a.id = $4::uuid AND a.candidate_id = c.id))`,
    [id, userId, body.slice(0, 4000), isUuid(applicationId) ? applicationId : null],
  );
}

/**
 * Folds a duplicate profile into the one being kept: applications and history
 * move across, empty fields are filled in, tags and skills are combined.
 */
export async function mergeCandidates(keepId: string, dropId: string, userId: string) {
  if (!isUuid(keepId) || !isUuid(dropId) || keepId === dropId) return false;
  const conn = await db();
  const [drop] = await conn.query<{ email: string; full_name: string }>(`SELECT email, full_name FROM candidates WHERE id = $1`, [dropId]);
  const [keep] = await conn.query<{ id: string }>(`SELECT id FROM candidates WHERE id = $1`, [keepId]);
  if (!drop || !keep) return false;
  const fill = ["phone", "location", "preferred_location", "specialisation", "experience", "employment_type", "qualifications", "current_title", "current_company", "notice_period", "availability", "linkedin_url", "summary"]
    .map((col) => `${col} = CASE WHEN k.${col} = '' THEN d.${col} ELSE k.${col} END`)
    .join(", ");
  await conn.tx([
    {
      text: `UPDATE candidates k SET ${fill},
               experience_years = COALESCE(k.experience_years, d.experience_years),
               owner_id = COALESCE(k.owner_id, d.owner_id),
               follow_up_on = COALESCE(LEAST(k.follow_up_on, d.follow_up_on), k.follow_up_on, d.follow_up_on),
               last_contacted_at = GREATEST(k.last_contacted_at, d.last_contacted_at),
               tags = ARRAY(SELECT DISTINCT unnest(k.tags || d.tags)),
               skills = ARRAY(SELECT DISTINCT unnest(k.skills || d.skills)),
               updated_at = now()
             FROM candidates d WHERE k.id = $1 AND d.id = $2`,
      params: [keepId, dropId],
    },
    { text: `UPDATE applications SET candidate_id = $1 WHERE candidate_id = $2`, params: [keepId, dropId] },
    { text: `UPDATE application_events SET candidate_id = $1 WHERE candidate_id = $2`, params: [keepId, dropId] },
    { text: `UPDATE candidate_files SET candidate_id = $1 WHERE candidate_id = $2`, params: [keepId, dropId] },
    {
      text: `INSERT INTO talent_pool_members (pool_id, candidate_id, added_by, added_at)
             SELECT pool_id, $1, added_by, added_at FROM talent_pool_members WHERE candidate_id = $2 ON CONFLICT DO NOTHING`,
      params: [keepId, dropId],
    },
    { text: `DELETE FROM candidates WHERE id = $1`, params: [dropId] },
    {
      text: `INSERT INTO application_events (candidate_id, user_id, kind, body, details) VALUES ($1, $2, 'merge', $3, $4::jsonb)`,
      params: [keepId, userId, `Merged the duplicate profile ${drop.full_name} (${drop.email})`, JSON.stringify({ email: drop.email })],
    },
  ]);
  return true;
}

/* ------------------------------------------------------------------ */
/* Search                                                               */
/* ------------------------------------------------------------------ */

export type CandidateFilters = {
  q?: string;
  skill?: string;
  tag?: string;
  priority?: string;
  owner?: string;
  followUp?: string;
  minYears?: string;
  maxYears?: string;
  location?: string;
  availability?: string;
  stage?: string;
  specialisation?: string;
  /** Words that must all appear in one of the candidate's resumes. */
  resume?: string;
  pool?: string;
  /** "never", or a number of days since the last contact. */
  contacted?: string;
};

export type CandidateRow = Candidate & {
  applications: number;
  latest_application_id: string | null;
  latest_status: ApplicationStatus | null;
  latest_position: string | null;
  has_resume: boolean;
};

/** Search words for resume text: quoted phrases stay together; at most 6. */
export function resumeWords(q: string) {
  const out: string[] = [];
  for (const m of q.slice(0, 200).matchAll(/"([^"]+)"|([^\s,]+)/g)) {
    const w = (m[1] ?? m[2]).trim();
    if (termPattern(w)) out.push(w);
  }
  return out.slice(0, 6);
}

export function candidateWhere(f: CandidateFilters, today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)) {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (f.q?.trim())
    add(
      (n) => `(c.full_name ILIKE $${n} OR c.email ILIKE $${n} OR c.phone ILIKE $${n} OR c.specialisation ILIKE $${n} OR c.current_title ILIKE $${n}
               OR c.current_company ILIKE $${n} OR c.qualifications ILIKE $${n} OR c.summary ILIKE $${n}
               OR EXISTS (SELECT 1 FROM unnest(c.skills || c.tags) s WHERE s ILIKE $${n}))`,
      `%${f.q.trim().slice(0, 100)}%`,
    );
  // Every listed skill must match (case-insensitive, partial).
  for (const skill of parseList(f.skill ?? "", 8)) add((n) => `EXISTS (SELECT 1 FROM unnest(c.skills) s WHERE s ILIKE $${n})`, `%${skill}%`);
  if (f.tag?.trim()) add((n) => `EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE lower(t) = lower($${n}))`, f.tag.trim());
  if (f.priority && (CANDIDATE_PRIORITIES as readonly string[]).includes(f.priority)) add((n) => `c.priority = $${n}`, f.priority);
  if (f.owner === "none") where.push(`c.owner_id IS NULL`);
  else if (isUuid(f.owner)) add((n) => `c.owner_id = $${n}`, f.owner);
  if (f.followUp === "due") add((n) => `c.follow_up_on <= $${n}::date`, today);
  else if (f.followUp === "week") add((n) => `c.follow_up_on <= ($${n}::date + 7)`, today);
  else if (f.followUp === "any") where.push(`c.follow_up_on IS NOT NULL`);
  const min = Number(f.minYears);
  if (f.minYears && Number.isFinite(min)) add((n) => `c.experience_years >= $${n}`, min);
  const max = Number(f.maxYears);
  if (f.maxYears && Number.isFinite(max)) add((n) => `c.experience_years <= $${n}`, max);
  if (f.location?.trim()) add((n) => `(c.location ILIKE $${n} OR c.preferred_location ILIKE $${n})`, `%${f.location.trim().slice(0, 80)}%`);
  if (f.availability && (AVAILABILITY_OPTIONS as readonly string[]).includes(f.availability)) add((n) => `c.availability = $${n}`, f.availability);
  if (f.stage && (APPLICATION_STATUSES as readonly string[]).includes(f.stage)) add((n) => `EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.status = $${n})`, f.stage);
  if (f.specialisation?.trim()) add((n) => `c.specialisation = $${n}`, f.specialisation.trim());
  for (const word of resumeWords(f.resume ?? ""))
    add(
      (n) => `(EXISTS (SELECT 1 FROM candidate_files cf WHERE cf.candidate_id = c.id AND cf.text_content ~* $${n})
               OR EXISTS (SELECT 1 FROM applications ra WHERE ra.candidate_id = c.id AND ra.resume_text ~* $${n}))`,
      pgTermRegex(word),
    );
  if (isUuid(f.pool)) add((n) => `EXISTS (SELECT 1 FROM talent_pool_members m WHERE m.candidate_id = c.id AND m.pool_id = $${n})`, f.pool);
  if (f.contacted === "never") where.push(`c.last_contacted_at IS NULL`);
  else if (/^\d{1,3}$/.test(f.contacted ?? "")) add((n) => `(c.last_contacted_at IS NULL OR c.last_contacted_at < now() - ($${n}::int * interval '1 day'))`, Number(f.contacted));
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const SORTS: Record<string, string> = {
  updated: "c.updated_at DESC",
  name: "lower(c.full_name) ASC",
  experience: "c.experience_years DESC NULLS LAST",
  followup: "c.follow_up_on ASC NULLS LAST",
  priority: "array_position(ARRAY['urgent','high','normal','low'], c.priority), c.updated_at DESC",
};

export async function listCandidates(f: CandidateFilters, { page = 1, pageSize = 25, sort = "updated" }: { page?: number; pageSize?: number; sort?: string } = {}) {
  const conn = await db();
  const { sql, params } = candidateWhere(f);
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = await conn.query<CandidateRow>(
    `SELECT ${COLS},
            (SELECT count(*)::int FROM applications a WHERE a.candidate_id = c.id) AS applications,
            l.id AS latest_application_id, l.status AS latest_status, l.position AS latest_position,
            (EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.resume_path IS NOT NULL) OR EXISTS (SELECT 1 FROM candidate_files f WHERE f.candidate_id = c.id)) AS has_resume
       FROM candidates c
       LEFT JOIN admin_users ow ON ow.id = c.owner_id
       LEFT JOIN LATERAL (SELECT id, status, position FROM applications a WHERE a.candidate_id = c.id ORDER BY submitted_at DESC LIMIT 1) l ON true
       ${sql} ORDER BY ${SORTS[sort] ?? SORTS.updated} LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM candidates c ${sql}`, params);
  return { rows, total: Number(count) };
}

/** Ids of every candidate matching the filters (for "select all matching" bulk actions), capped. */
export async function candidateIds(f: CandidateFilters, cap = 2000) {
  const conn = await db();
  const { sql, params } = candidateWhere(f);
  return (await conn.query<{ id: string }>(`SELECT c.id FROM candidates c ${sql} ORDER BY c.updated_at DESC LIMIT ${cap}`, params)).map((r) => r.id);
}

export async function candidateFacets() {
  const conn = await db();
  const [tags, skills, specs] = await Promise.all([
    conn.query<{ v: string; n: number }>(`SELECT t AS v, count(*)::int AS n FROM candidates, unnest(tags) t GROUP BY t ORDER BY n DESC, t LIMIT 60`),
    conn.query<{ v: string; n: number }>(`SELECT s AS v, count(*)::int AS n FROM candidates, unnest(skills) s GROUP BY s ORDER BY n DESC, s LIMIT 80`),
    conn.query<{ v: string }>(`SELECT DISTINCT specialisation AS v FROM candidates WHERE specialisation <> '' ORDER BY 1`),
  ]);
  return { tags: tags.map((r) => r.v), skills: skills.map((r) => r.v), specialisations: specs.map((r) => r.v) };
}

/** Candidates whose follow-up date has arrived, for a recruiter's workspace. */
export async function dueFollowUps(ownerId?: string, limit = 20) {
  const conn = await db();
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return conn.query<{ id: string; full_name: string; follow_up_on: string; priority: string; owner_name: string | null }>(
    `SELECT c.id, c.full_name, to_char(c.follow_up_on, 'YYYY-MM-DD') AS follow_up_on, c.priority, ow.name AS owner_name
       FROM candidates c LEFT JOIN admin_users ow ON ow.id = c.owner_id
      WHERE c.follow_up_on <= $1::date AND ($2::uuid IS NULL OR c.owner_id = $2::uuid)
      ORDER BY c.follow_up_on, c.full_name LIMIT ${limit}`,
    [today, isUuid(ownerId) ? ownerId : null],
  );
}

/**
 * Everything held about one candidate, for an access request (M-19): the
 * profile, each application with what was submitted and its timeline, emails
 * sent to them, interviews with feedback, uploaded files (names and extracted
 * text; the files themselves are downloaded separately) and pool memberships.
 * The client behind an opening is confidential and is left out; the public
 * employer label is given instead.
 */
export async function exportCandidateData(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [profile] = await conn.query<Record<string, unknown>>(
    `SELECT c.email, c.full_name, c.phone, c.location, c.preferred_location, c.specialisation, c.experience, c.employment_type, c.tags, c.skills,
            c.qualifications, c.experience_years::float8 AS experience_years, c.current_title, c.current_company, c.notice_period, c.availability,
            c.linkedin_url, c.summary, c.priority, to_char(c.follow_up_on, 'YYYY-MM-DD') AS follow_up_on, c.last_contacted_at, c.created_at, c.updated_at,
            ow.name AS owner
       FROM candidates c LEFT JOIN admin_users ow ON ow.id = c.owner_id WHERE c.id = $1`,
    [id],
  );
  if (!profile) return null;
  const [applications, timeline, emails, interviews, files, pools] = await Promise.all([
    conn.query(
      `SELECT a.number::text AS number, a.source, a.position, a.experience, a.message, a.details, a.status, a.submitted_at, a.stage_changed_at, a.hired_at,
              o.title AS opening_title, o.public_client_label AS employer, a.resume_name, a.resume_size, a.resume_text, ru.name AS assigned_to
         FROM applications a LEFT JOIN job_openings o ON o.id = a.opening_id LEFT JOIN admin_users ru ON ru.id = a.assigned_to
        WHERE a.candidate_id = $1 ORDER BY a.submitted_at`,
      [id],
    ),
    conn.query(
      `SELECT e.created_at, e.kind, e.body, e.from_status, e.to_status, e.details, u.name AS by, a.number::text AS application_number
         FROM application_events e LEFT JOIN admin_users u ON u.id = e.user_id LEFT JOIN applications a ON a.id = e.application_id
        WHERE e.candidate_id = $1 ORDER BY e.created_at`,
      [id],
    ),
    conn.query(`SELECT m.created_at, m.to_email, m.subject, m.body, m.status, u.name AS sent_by FROM email_messages m LEFT JOIN admin_users u ON u.id = m.sent_by WHERE m.candidate_id = $1 ORDER BY m.created_at`, [id]),
    conn.query(
      `SELECT i.round, i.scheduled_at, i.duration_minutes, i.mode, i.status, i.notes, i.cancel_reason, a.number::text AS application_number,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('by', u.name, 'rating', f.rating, 'recommendation', f.recommendation, 'notes', f.notes, 'at', f.created_at) ORDER BY f.created_at)
                          FROM interview_feedback f LEFT JOIN admin_users u ON u.id = f.user_id WHERE f.interview_id = i.id), '[]'::jsonb) AS feedback
         FROM interviews i JOIN applications a ON a.id = i.application_id WHERE a.candidate_id = $1 ORDER BY i.scheduled_at`,
      [id],
    ),
    conn.query(`SELECT f.file_name, f.file_size, f.file_type, f.text_content, f.created_at, u.name AS uploaded_by FROM candidate_files f LEFT JOIN admin_users u ON u.id = f.uploaded_by WHERE f.candidate_id = $1 ORDER BY f.created_at`, [id]),
    conn.query(`SELECT p.name AS pool, m.added_at FROM talent_pool_members m JOIN talent_pools p ON p.id = m.pool_id WHERE m.candidate_id = $1 ORDER BY m.added_at`, [id]),
  ]);
  return { exportedAt: new Date().toISOString(), profile, applications, timeline, emails, interviews, files, talentPools: pools };
}
