import "server-only";
import { randomBytes } from "node:crypto";
import { db, isDbConfigured } from "@/lib/db/client";
import { clientIdFor } from "./clients";
import { EMPLOYMENT_TYPES, OPENING_STATUSES, WORK_MODES, type OpeningStatus } from "./constants";

export type Opening = {
  id: string;
  slug: string;
  title: string;
  sap_module: string;
  client_name: string;
  public_client_label: string;
  location: string;
  work_mode: string;
  experience: string;
  employment_type: string;
  salary_range: string;
  summary: string;
  description: string;
  skills: string[];
  status: OpeningStatus;
  closing_date: string | null;
  vacancies: number;
  salary_visible: boolean;
  min_experience_years: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpeningWithCounts = Opening & { applications: number; new_applications: number; recruiter_names: string[] };

export type OpeningInput = Omit<Opening, "id" | "slug" | "published_at" | "created_at" | "updated_at">;

const COLS = `id, slug, title, sap_module, client_name, public_client_label, location, work_mode, experience, employment_type, salary_range,
  summary, description, skills, status, to_char(closing_date, 'YYYY-MM-DD') AS closing_date, vacancies, salary_visible,
  min_experience_years::float8 AS min_experience_years, published_at, created_at, updated_at`;

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");

/** Validates admin form input. Returns the clean value or field errors. */
export function parseOpening(form: Record<string, unknown>): { data: OpeningInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const data: OpeningInput = {
    title: str(form.title, 160),
    sap_module: str(form.sap_module, 80),
    client_name: str(form.client_name, 160),
    public_client_label: str(form.public_client_label, 160),
    location: str(form.location, 160),
    work_mode: str(form.work_mode, 20),
    experience: str(form.experience, 40),
    employment_type: str(form.employment_type, 40),
    salary_range: str(form.salary_range, 80),
    summary: str(form.summary, 400),
    description: str(form.description, 12000),
    skills: str(form.skills, 1000)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30),
    status: (OPENING_STATUSES as readonly string[]).includes(str(form.status)) ? (str(form.status) as OpeningStatus) : "draft",
    closing_date: /^\d{4}-\d{2}-\d{2}$/.test(str(form.closing_date)) ? str(form.closing_date) : null,
    vacancies: str(form.vacancies) === "" ? 1 : Number(str(form.vacancies)),
    // Shown unless explicitly hidden ("hide" from the form, false from code).
    salary_visible: !(form.salary_visible === "hide" || form.salary_visible === false),
    min_experience_years: str(form.min_experience_years) === "" ? null : Number(str(form.min_experience_years)),
  };
  if (data.title.length < 3) errors.title = "Enter the job title.";
  if (!data.location) errors.location = "Enter the location.";
  if (!(WORK_MODES as readonly string[]).includes(data.work_mode)) errors.work_mode = "Choose a work mode.";
  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(data.employment_type)) errors.employment_type = "Choose an employment type.";
  if (!data.experience) errors.experience = "Choose the experience level.";
  if (!data.public_client_label) errors.public_client_label = "Enter how the employer is described publicly.";
  if (!Number.isInteger(data.vacancies) || data.vacancies < 1 || data.vacancies > 999) errors.vacancies = "Enter a number of positions from 1 to 999.";
  if (data.min_experience_years !== null && (!Number.isFinite(data.min_experience_years) || data.min_experience_years < 0 || data.min_experience_years > 60))
    errors.min_experience_years = "Enter years between 0 and 60.";
  if (data.status === "published" && data.description.length < 40) errors.description = "Add a description (at least a few lines) before publishing.";
  return { data, errors };
}

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 70)
    .replace(/-$/, "");
  return `${base || "job"}-${randomBytes(3).toString("hex")}`;
}

export async function listOpenings({ status, q }: { status?: string; q?: string } = {}) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  if (status && (OPENING_STATUSES as readonly string[]).includes(status)) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(o.title ILIKE $${params.length} OR o.client_name ILIKE $${params.length} OR o.sap_module ILIKE $${params.length} OR o.location ILIKE $${params.length})`);
  }
  return conn.query<OpeningWithCounts>(
    `SELECT o.id, o.slug, o.title, o.sap_module, o.client_name, o.public_client_label, o.location, o.work_mode, o.experience,
            o.employment_type, o.salary_range, o.summary, o.description, o.skills, o.status,
            to_char(o.closing_date, 'YYYY-MM-DD') AS closing_date, o.vacancies, o.salary_visible, o.min_experience_years::float8 AS min_experience_years,
            o.published_at, o.created_at, o.updated_at,
            ARRAY(SELECT u.name FROM opening_recruiters r JOIN admin_users u ON u.id = r.user_id WHERE r.opening_id = o.id ORDER BY u.name) AS recruiter_names,
            (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id) AS applications,
            (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id AND a.status = 'new') AS new_applications
       FROM job_openings o ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY CASE o.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, o.updated_at DESC`,
    params,
  );
}

export async function getOpening(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Opening>(`SELECT ${COLS} FROM job_openings WHERE id = $1`, [id]);
  return row ?? null;
}

export async function createOpening(input: OpeningInput, userId: string) {
  const conn = await db();
  const [row] = await conn.query<{ id: string }>(
    // The client is found (or added to the CRM) in the same statement, so the link is never half made.
    `WITH ${clientIdFor(4, 16)},
     o AS (
       INSERT INTO job_openings (slug, title, sap_module, client_name, public_client_label, location, work_mode, experience, employment_type,
         salary_range, summary, description, skills, status, closing_date, published_at, created_by, vacancies, salary_visible, min_experience_years, client_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CASE WHEN $14 = 'published' THEN now() END, $16, $17, $18, $19, (SELECT id FROM client_link))
       RETURNING id, client_id
     ),
     e AS (INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $16, 'opening', 'Opening added: ' || $2 FROM o WHERE client_id IS NOT NULL)
     SELECT id FROM o`,
    [
      slugify(input.title),
      input.title,
      input.sap_module,
      input.client_name,
      input.public_client_label,
      input.location,
      input.work_mode,
      input.experience,
      input.employment_type,
      input.salary_range,
      input.summary,
      input.description,
      input.skills,
      input.status,
      input.closing_date,
      userId,
      input.vacancies,
      input.salary_visible,
      input.min_experience_years,
    ],
  );
  return row.id;
}

export async function updateOpening(id: string, input: OpeningInput, userId: string | null = null) {
  const conn = await db();
  await conn.query(
    `WITH ${clientIdFor(4, 19)},
     prev AS (SELECT client_id FROM job_openings WHERE id = $1),
     o AS (
       UPDATE job_openings SET title=$2, sap_module=$3, client_name=$4, public_client_label=$5, location=$6, work_mode=$7, experience=$8,
         employment_type=$9, salary_range=$10, summary=$11, description=$12, skills=$13, status=$14, closing_date=$15,
         vacancies=$16, salary_visible=$17, min_experience_years=$18, client_id = (SELECT id FROM client_link),
         published_at = CASE WHEN $14 = 'published' AND published_at IS NULL THEN now() ELSE published_at END, updated_at = now()
       WHERE id = $1 RETURNING client_id
     ),
     e AS (
       INSERT INTO client_events (client_id, user_id, kind, body)
       SELECT client_id, $19, 'opening', 'Opening linked: ' || $2 FROM o WHERE client_id IS NOT NULL AND client_id IS DISTINCT FROM (SELECT client_id FROM prev)
     )
     SELECT 1`,
    [
      id,
      input.title,
      input.sap_module,
      input.client_name,
      input.public_client_label,
      input.location,
      input.work_mode,
      input.experience,
      input.employment_type,
      input.salary_range,
      input.summary,
      input.description,
      input.skills,
      input.status,
      input.closing_date,
      input.vacancies,
      input.salary_visible,
      input.min_experience_years,
      userId,
    ],
  );
}

/** Recruiters responsible for an opening. */
export async function getOpeningRecruiters(id: string) {
  const conn = await db();
  return (await conn.query<{ user_id: string }>(`SELECT user_id FROM opening_recruiters WHERE opening_id = $1`, [id])).map((r) => r.user_id);
}

export async function setOpeningRecruiters(id: string, userIds: string[]) {
  const ids = [...new Set(userIds.filter((u) => /^[0-9a-f-]{36}$/i.test(u)))].slice(0, 20);
  const conn = await db();
  await conn.tx([
    { text: `DELETE FROM opening_recruiters WHERE opening_id = $1`, params: [id] },
    ...(ids.length
      ? [
          {
            text: `INSERT INTO opening_recruiters (opening_id, user_id)
                   SELECT $1, u.id FROM admin_users u WHERE u.id = ANY($2::uuid[]) AND u.active AND u.role IN ('super_admin','recruiter')`,
            params: [id, ids],
          },
        ]
      : []),
  ]);
}

export async function setOpeningStatus(id: string, status: OpeningStatus) {
  const conn = await db();
  await conn.query(
    `UPDATE job_openings SET status = $2, published_at = CASE WHEN $2 = 'published' AND published_at IS NULL THEN now() ELSE published_at END, updated_at = now() WHERE id = $1`,
    [id, status],
  );
}

export async function deleteOpening(id: string) {
  const conn = await db();
  await conn.query(`DELETE FROM job_openings WHERE id = $1`, [id]);
}

/* ------------------------------------------------------------------ */
/* Public website                                                       */
/* ------------------------------------------------------------------ */

export type PublicOpening = Omit<Opening, "client_name">;
if (!COLS.includes("salary_range,")) throw new Error("openings: salary column list changed; update PUBLIC_COLS");

// No client name, and the salary only when it is set to be shown.
const PUBLIC_COLS = COLS.replace("client_name, public_client_label", "public_client_label").replace(
  "salary_range,",
  "CASE WHEN salary_visible THEN salary_range ELSE '' END AS salary_range,",
);
const LIVE = `status = 'published' AND (closing_date IS NULL OR closing_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date)`;

/** Published, unexpired openings. Never includes the confidential client name. */
export async function listPublicOpenings(): Promise<PublicOpening[]> {
  if (!isDbConfigured()) return [];
  try {
    const conn = await db();
    return await conn.query<PublicOpening>(`SELECT ${PUBLIC_COLS} FROM job_openings WHERE ${LIVE} ORDER BY published_at DESC NULLS LAST, created_at DESC`);
  } catch (err) {
    console.error("[openings] public list failed", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getPublicOpening(slug: string): Promise<PublicOpening | null> {
  if (!isDbConfigured() || !/^[a-z0-9-]{3,90}$/.test(slug)) return null;
  try {
    const conn = await db();
    const [row] = await conn.query<PublicOpening>(`SELECT ${PUBLIC_COLS} FROM job_openings WHERE slug = $1 AND ${LIVE}`, [slug]);
    return row ?? null;
  } catch (err) {
    console.error("[openings] public get failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/** For the apply endpoint: the live opening a submission refers to. */
export async function getLiveOpeningById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Opening>(`SELECT ${COLS} FROM job_openings WHERE id = $1 AND ${LIVE}`, [id]);
  return row ?? null;
}
