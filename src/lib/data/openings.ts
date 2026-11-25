import "server-only";
import { randomBytes } from "node:crypto";
import { db, isDbConfigured } from "@/lib/db/client";
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
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpeningWithCounts = Opening & { applications: number; new_applications: number };

export type OpeningInput = Omit<Opening, "id" | "slug" | "published_at" | "created_at" | "updated_at">;

const COLS = `id, slug, title, sap_module, client_name, public_client_label, location, work_mode, experience, employment_type, salary_range,
  summary, description, skills, status, to_char(closing_date, 'YYYY-MM-DD') AS closing_date, published_at, created_at, updated_at`;

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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
  };
  if (data.title.length < 3) errors.title = "Enter the job title.";
  if (!data.location) errors.location = "Enter the location.";
  if (!(WORK_MODES as readonly string[]).includes(data.work_mode)) errors.work_mode = "Choose a work mode.";
  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(data.employment_type)) errors.employment_type = "Choose an employment type.";
  if (!data.experience) errors.experience = "Choose the experience level.";
  if (!data.public_client_label) errors.public_client_label = "Enter how the employer is described publicly.";
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
            to_char(o.closing_date, 'YYYY-MM-DD') AS closing_date, o.published_at, o.created_at, o.updated_at,
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
    `INSERT INTO job_openings (slug, title, sap_module, client_name, public_client_label, location, work_mode, experience, employment_type,
       salary_range, summary, description, skills, status, closing_date, published_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CASE WHEN $14 = 'published' THEN now() END, $16) RETURNING id`,
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
    ],
  );
  return row.id;
}

export async function updateOpening(id: string, input: OpeningInput) {
  const conn = await db();
  await conn.query(
    `UPDATE job_openings SET title=$2, sap_module=$3, client_name=$4, public_client_label=$5, location=$6, work_mode=$7, experience=$8,
       employment_type=$9, salary_range=$10, summary=$11, description=$12, skills=$13, status=$14, closing_date=$15,
       published_at = CASE WHEN $14 = 'published' AND published_at IS NULL THEN now() ELSE published_at END, updated_at = now()
     WHERE id = $1`,
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
    ],
  );
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

const PUBLIC_COLS = COLS.replace("client_name, public_client_label", "public_client_label");
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
