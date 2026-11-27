import "server-only";
import { db } from "@/lib/db/client";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "./constants";
import { isIsoDate } from "@/lib/dates";

export type Enquiry = {
  id: string;
  number: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  service: string;
  requirement: string;
  message: string;
  status: EnquiryStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export async function recordEnquiry(e: { name: string; company: string; email: string; phone: string; service: string; requirement: string; message: string }) {
  const conn = await db();
  const [row] = await conn.query<{ id: string; number: string }>(
    `INSERT INTO enquiries (name, company, email, phone, service, requirement, message) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, number`,
    [e.name, e.company, e.email.trim().toLowerCase(), e.phone, e.service, e.requirement, e.message],
  );
  return { id: row.id, number: Number(row.number) };
}

export async function listEnquiries({ q, status, from, to }: { q?: string; status?: string; from?: string; to?: string }, { page = 1, pageSize = 25 } = {}) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (q?.trim()) add((n) => `(name ILIKE $${n} OR company ILIKE $${n} OR email ILIKE $${n} OR phone ILIKE $${n} OR service ILIKE $${n} OR message ILIKE $${n})`, `%${q.trim().slice(0, 100)}%`);
  if (status && (ENQUIRY_STATUSES as readonly string[]).includes(status)) add((n) => `status = $${n}`, status);
  if (from && isIsoDate(from)) add((n) => `created_at >= ($${n}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`, from);
  if (to && isIsoDate(to)) add((n) => `created_at < (($${n}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`, to);
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = await conn.query<Enquiry>(`SELECT * FROM enquiries ${sql} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, params);
  const [stats] = await conn.query<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'new')::int AS new,
            count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
            count(*) FILTER (WHERE status = 'converted')::int AS converted
       FROM enquiries ${sql}`,
    params,
  );
  return { rows, stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v)])) as Record<string, number> };
}

export async function getEnquiry(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Enquiry>(`SELECT * FROM enquiries WHERE id = $1`, [id]);
  return row ?? null;
}

export async function updateEnquiry(id: string, status: EnquiryStatus, notes: string) {
  const conn = await db();
  await conn.query(`UPDATE enquiries SET status = $2, notes = $3, updated_at = now() WHERE id = $1`, [id, status, notes.slice(0, 8000)]);
}

export async function deleteEnquiry(id: string) {
  const conn = await db();
  await conn.query(`DELETE FROM enquiries WHERE id = $1`, [id]);
}
