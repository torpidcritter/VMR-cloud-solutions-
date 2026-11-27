import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { normaliseEmail } from "@/lib/auth/session";

const isUuid = (v?: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ------------------------------------------------------------------ */
/* Resumes uploaded to a profile                                        */
/* ------------------------------------------------------------------ */

export type CandidateFile = {
  id: string;
  candidate_id: string;
  file_name: string;
  file_size: number;
  file_type: "pdf" | "doc" | "docx";
  text_status: "ok" | "empty" | "failed";
  text_length: number;
  uploaded_by_name: string | null;
  created_at: string;
};

export type NewFile = { path: string; name: string; size: number; type: "pdf" | "doc" | "docx"; text: string; status: "ok" | "empty" | "failed" };

/** Records an uploaded resume and notes it on the timeline, together. */
export async function addCandidateFile(candidateId: string, f: NewFile, userId: string) {
  if (!isUuid(candidateId)) return null;
  const conn = await db();
  const id = randomUUID();
  const [{ n }] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM candidates WHERE id = $1`, [candidateId]);
  if (!n) return null;
  await conn.tx([
    {
      text: `INSERT INTO candidate_files (id, candidate_id, file_path, file_name, file_size, file_type, text_content, text_status, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params: [id, candidateId, f.path, f.name.slice(0, 180), f.size, f.type, f.text, f.status, userId],
    },
    {
      text: `INSERT INTO application_events (candidate_id, user_id, kind, body, details) VALUES ($1, $2, 'file', $3, $4::jsonb)`,
      params: [candidateId, userId, `Uploaded the resume ${f.name.slice(0, 180)}`, JSON.stringify({ file_id: id, text: f.status })],
    },
    { text: `UPDATE candidates SET updated_at = now() WHERE id = $1`, params: [candidateId] },
  ]);
  return id;
}

export async function listCandidateFiles(candidateId: string) {
  if (!isUuid(candidateId)) return [];
  const conn = await db();
  return conn.query<CandidateFile>(
    `SELECT f.id, f.candidate_id, f.file_name, f.file_size, f.file_type, f.text_status, length(f.text_content) AS text_length, u.name AS uploaded_by_name, f.created_at
       FROM candidate_files f LEFT JOIN admin_users u ON u.id = f.uploaded_by WHERE f.candidate_id = $1 ORDER BY f.created_at DESC`,
    [candidateId],
  );
}

/** Where the file is stored, for the download route. */
export async function getCandidateFileRef(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ file_path: string; file_name: string; file_type: string; candidate_id: string }>(
    `SELECT file_path, file_name, file_type, candidate_id FROM candidate_files WHERE id = $1`,
    [id],
  );
  return row ?? null;
}

/** Removes the record and returns the stored path, so the caller can delete the file. */
export async function deleteCandidateFile(id: string, userId: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ file_path: string; file_name: string; candidate_id: string }>(`SELECT file_path, file_name, candidate_id FROM candidate_files WHERE id = $1`, [id]);
  if (!row) return null;
  await conn.tx([
    { text: `DELETE FROM candidate_files WHERE id = $1`, params: [id] },
    {
      text: `INSERT INTO application_events (candidate_id, user_id, kind, body) VALUES ($1, $2, 'file', $3)`,
      params: [row.candidate_id, userId, `Deleted the resume ${row.file_name}`],
    },
  ]);
  return row;
}

/* ------------------------------------------------------------------ */
/* Adding a candidate by hand                                           */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[()\-\s\d]{7,20}$/;

export type NewCandidate = { fullName: string; email: string; phone: string; location: string; currentTitle: string; skills: string[]; experienceYears: number | null; summary: string };

export function parseNewCandidate(form: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const years = str(form.experienceYears, 5);
  const data: NewCandidate = {
    fullName: str(form.fullName, 120),
    email: str(form.email, 200),
    phone: str(form.phone, 30),
    location: str(form.location, 120),
    currentTitle: str(form.currentTitle, 120),
    skills: [
      ...new Set(
        str(form.skills, 1000)
          .split(/[,;\n]/)
          .map((s) => s.trim().slice(0, 60))
          .filter(Boolean),
      ),
    ].slice(0, 40),
    experienceYears: years === "" ? null : Number(years),
    summary: str(form.summary, 2000),
  };
  if (data.fullName.length < 2) errors.fullName = "Enter the candidate's name.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = "Enter a valid phone number.";
  if (data.experienceYears !== null && (!Number.isFinite(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 60)) errors.experienceYears = "Enter years between 0 and 60.";
  return { data, errors };
}

/** Creates a Talent Bank profile with no application. Null if the email is already on file. */
export async function createCandidate(c: NewCandidate, userId: string) {
  const conn = await db();
  const id = randomUUID();
  // One statement, so the profile and its first history entry are written together.
  const [row] = await conn.query<{ id: string }>(
    `WITH c AS (
       INSERT INTO candidates (id, email, full_name, phone, location, current_title, skills, experience_years, summary, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10)
       ON CONFLICT (email) DO NOTHING RETURNING id
     ), e AS (
       INSERT INTO application_events (candidate_id, user_id, kind, body, details) SELECT id, $10, 'edit', 'Added to the Talent Bank', '{"created": true}'::jsonb FROM c
     )
     SELECT id FROM c`,
    [id, normaliseEmail(c.email), c.fullName, c.phone, c.location, c.currentTitle, c.skills, c.experienceYears, c.summary, userId],
  );
  if (!row) return null;
  return id;
}

export async function candidateIdByEmail(email: string) {
  const conn = await db();
  const [row] = await conn.query<{ id: string }>(`SELECT id FROM candidates WHERE email = $1`, [normaliseEmail(email)]);
  return row?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Talent pools                                                         */
/* ------------------------------------------------------------------ */

export type TalentPool = { id: string; name: string; description: string; members: number; created_by_name: string | null; created_at: string; updated_at: string };

export function parsePool(form: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const data = { name: str(form.name, 80), description: str(form.description, 500) };
  if (!data.name) errors.name = "Name the pool, for example S/4HANA FICO – Bengaluru.";
  return { data, errors };
}

export async function listPools() {
  const conn = await db();
  return conn.query<TalentPool>(
    `SELECT p.id, p.name, p.description, p.created_at, p.updated_at, u.name AS created_by_name,
            (SELECT count(*)::int FROM talent_pool_members m WHERE m.pool_id = p.id) AS members
       FROM talent_pools p LEFT JOIN admin_users u ON u.id = p.created_by ORDER BY lower(p.name)`,
  );
}

export async function getPool(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<TalentPool>(
    `SELECT p.id, p.name, p.description, p.created_at, p.updated_at, u.name AS created_by_name,
            (SELECT count(*)::int FROM talent_pool_members m WHERE m.pool_id = p.id) AS members
       FROM talent_pools p LEFT JOIN admin_users u ON u.id = p.created_by WHERE p.id = $1`,
    [id],
  );
  return row ?? null;
}

/** "duplicate" when another pool already has that name. */
export async function savePool(id: string | null, data: { name: string; description: string }, userId: string): Promise<string | "duplicate" | null> {
  const conn = await db();
  const [clash] = await conn.query<{ id: string }>(`SELECT id FROM talent_pools WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)`, [data.name, isUuid(id) ? id : null]);
  if (clash) return "duplicate";
  if (id) {
    if (!isUuid(id)) return null;
    const rows = await conn.query<{ id: string }>(`UPDATE talent_pools SET name = $2, description = $3, updated_at = now() WHERE id = $1 RETURNING id`, [id, data.name, data.description]);
    return rows[0]?.id ?? null;
  }
  try {
    const [row] = await conn.query<{ id: string }>(`INSERT INTO talent_pools (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`, [data.name, data.description, userId]);
    return row.id;
  } catch (err) {
    // Two people creating the same name at once: the unique index decides.
    if (/talent_pools_name|unique/i.test(String(err))) return "duplicate";
    throw err;
  }
}

export async function deletePool(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ name: string }>(`DELETE FROM talent_pools WHERE id = $1 RETURNING name`, [id]);
  return row?.name ?? null;
}

/** Adds candidates to a pool; those already in it are skipped. Returns how many were added. */
export async function addToPool(poolId: string, candidateIds: string[], userId: string) {
  const ids = [...new Set(candidateIds.filter(isUuid))].slice(0, 2000);
  if (!isUuid(poolId) || !ids.length) return 0;
  const conn = await db();
  const [pool] = await conn.query<{ name: string }>(`SELECT name FROM talent_pools WHERE id = $1`, [poolId]);
  if (!pool) return 0;
  // Members, their history entries and the pool's timestamp in one statement.
  const added = await conn.query<{ candidate_id: string }>(
    `WITH added AS (
       INSERT INTO talent_pool_members (pool_id, candidate_id, added_by)
       SELECT $1, c.id, $3 FROM candidates c WHERE c.id = ANY($2::uuid[])
       ON CONFLICT DO NOTHING RETURNING candidate_id
     ), ev AS (
       INSERT INTO application_events (candidate_id, user_id, kind, body, details)
       SELECT candidate_id, $3, 'pool', $4, $5::jsonb FROM added
     ), touched AS (
       UPDATE talent_pools SET updated_at = now() WHERE id = $1 AND EXISTS (SELECT 1 FROM added)
     )
     SELECT candidate_id FROM added`,
    [poolId, ids, userId, `Added to the talent pool ${pool.name}`, JSON.stringify({ pool_id: poolId })],
  );
  return added.length;
}

export async function removeFromPool(poolId: string, candidateId: string, userId: string) {
  if (!isUuid(poolId) || !isUuid(candidateId)) return false;
  const conn = await db();
  const [pool] = await conn.query<{ name: string }>(`SELECT name FROM talent_pools WHERE id = $1`, [poolId]);
  if (!pool) return false;
  const gone = await conn.query<{ candidate_id: string }>(
    `WITH gone AS (DELETE FROM talent_pool_members WHERE pool_id = $1 AND candidate_id = $2 RETURNING candidate_id),
          ev AS (INSERT INTO application_events (candidate_id, user_id, kind, body, details) SELECT candidate_id, $3, 'pool', $4, $5::jsonb FROM gone)
     SELECT candidate_id FROM gone`,
    [poolId, candidateId, userId, `Removed from the talent pool ${pool.name}`, JSON.stringify({ pool_id: poolId })],
  );
  if (!gone.length) return false;
  return true;
}

export async function poolsForCandidate(candidateId: string) {
  if (!isUuid(candidateId)) return [];
  const conn = await db();
  return conn.query<{ id: string; name: string; added_at: string }>(
    `SELECT p.id, p.name, m.added_at FROM talent_pool_members m JOIN talent_pools p ON p.id = m.pool_id WHERE m.candidate_id = $1 ORDER BY lower(p.name)`,
    [candidateId],
  );
}

/* ------------------------------------------------------------------ */
/* Reading text from resumes sent before text extraction existed        */
/* ------------------------------------------------------------------ */

export async function resumeTextCoverage() {
  const conn = await db();
  const [r] = await conn.query<{ total: number; done: number }>(
    `SELECT count(*)::int AS total, count(resume_text_status)::int AS done FROM applications WHERE resume_path IS NOT NULL`,
  );
  return { total: Number(r.total), done: Number(r.done) };
}

export async function applicationsWithoutText(limit = 20) {
  const conn = await db();
  return conn.query<{ id: string; resume_path: string; resume_name: string | null }>(
    `SELECT id, resume_path, resume_name FROM applications WHERE resume_path IS NOT NULL AND resume_text_status IS NULL ORDER BY submitted_at DESC LIMIT ${Math.min(100, limit)}`,
  );
}

export async function saveApplicationText(id: string, status: "ok" | "empty" | "failed", text: string) {
  const conn = await db();
  await conn.query(`UPDATE applications SET resume_text = $2, resume_text_status = $3 WHERE id = $1`, [id, text, status]);
}
