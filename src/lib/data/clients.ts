import "server-only";
import { randomUUID } from "node:crypto";
import { db, type Statement } from "@/lib/db/client";
import { CLIENT_STATUSES, REQUIREMENT_STATUSES, type ClientStatus, type RequirementStatus } from "./constants";
import { isIsoDate } from "@/lib/dates";

/**
 * The client CRM: companies VMR recruits for, their contacts and the roles
 * they have asked for. Client details are confidential. Nothing here is read
 * by the public website, and openings expose only public_client_label there.
 */

const isUuid = (v?: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[()\-\s\d]{7,20}$/;

export type Client = {
  id: string;
  name: string;
  industry: string;
  website: string;
  location: string;
  status: ClientStatus;
  account_manager_id: string | null;
  account_manager_name: string | null;
  notes: string;
  enquiry_id: string | null;
  enquiry_number: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRow = Client & {
  open_openings: number;
  submissions: number;
  placements: number;
  open_positions: number;
  primary_contact: string | null;
};

export type ClientContact = { id: string; client_id: string; name: string; title: string; email: string; phone: string; is_primary: boolean; created_at: string };

export type ClientRequirement = {
  id: string;
  client_id: string;
  title: string;
  sap_module: string;
  positions: number;
  status: RequirementStatus;
  needed_by: string | null;
  notes: string;
  opening_id: string | null;
  opening_title: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type ClientEvent = { id: string; kind: string; body: string; user_name: string | null; created_at: string };

export type ClientOpening = {
  id: string;
  title: string;
  status: string;
  location: string;
  vacancies: number;
  applications: number;
  in_process: number;
  placed: number;
  created_at: string;
};

export type ClientInput = { name: string; industry: string; website: string; location: string; status: ClientStatus; account_manager_id: string | null; notes: string };

export function parseClient(form: Record<string, unknown>): { data: ClientInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const status = str(form.status, 20);
  const website = str(form.website, 200);
  const data: ClientInput = {
    name: str(form.name, 160),
    industry: str(form.industry, 120),
    website,
    location: str(form.location, 160),
    status: (CLIENT_STATUSES as readonly string[]).includes(status) ? (status as ClientStatus) : "active",
    account_manager_id: isUuid(str(form.account_manager_id, 40)) ? str(form.account_manager_id, 40) : null,
    notes: str(form.notes, 8000),
  };
  if (!data.name) errors.name = "Enter the client's company name.";
  if (website && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(website)) errors.website = "Enter a web address such as example.com.";
  return { data, errors };
}

/** Turns "example.com" into a link that is always http(s). */
export const websiteHref = (w: string) => (!w ? "" : /^https?:\/\//i.test(w) ? w : `https://${w}`);

const SELECT = `SELECT c.id, c.name, c.industry, c.website, c.location, c.status, c.account_manager_id, m.name AS account_manager_name, c.notes,
    c.enquiry_id, e.number::text AS enquiry_number, c.created_at, c.updated_at
  FROM clients c LEFT JOIN admin_users m ON m.id = c.account_manager_id LEFT JOIN enquiries e ON e.id = c.enquiry_id`;

export async function listClients(f: { q?: string; status?: string; manager?: string } = {}) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (f.q?.trim()) {
    add(
      (n) => `(c.name ILIKE $${n} OR c.industry ILIKE $${n} OR c.location ILIKE $${n} OR EXISTS (SELECT 1 FROM client_contacts k WHERE k.client_id = c.id AND (k.name ILIKE $${n} OR k.email ILIKE $${n})))`,
      `%${f.q.trim().slice(0, 100)}%`,
    );
  }
  if (f.status && (CLIENT_STATUSES as readonly string[]).includes(f.status)) add((n) => `c.status = $${n}`, f.status);
  if (f.manager === "none") where.push(`c.account_manager_id IS NULL`);
  else if (isUuid(f.manager)) add((n) => `c.account_manager_id = $${n}::uuid`, f.manager);
  return conn.query<ClientRow>(
    `SELECT x.*,
            (SELECT count(*)::int FROM job_openings o WHERE o.client_id = x.id AND o.status <> 'closed') AS open_openings,
            (SELECT count(*)::int FROM applications a JOIN job_openings o ON o.id = a.opening_id WHERE o.client_id = x.id) AS submissions,
            (SELECT count(*)::int FROM applications a JOIN job_openings o ON o.id = a.opening_id WHERE o.client_id = x.id AND a.status = 'hired') AS placements,
            (SELECT COALESCE(sum(r.positions), 0)::int FROM client_requirements r WHERE r.client_id = x.id AND r.status = 'open') AS open_positions,
            (SELECT k.name FROM client_contacts k WHERE k.client_id = x.id ORDER BY k.is_primary DESC, k.created_at LIMIT 1) AS primary_contact
       FROM (${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}) x
      ORDER BY CASE x.status WHEN 'active' THEN 0 WHEN 'prospect' THEN 1 ELSE 2 END, lower(x.name)`,
    params,
  );
}

export async function getClient(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Client>(`${SELECT} WHERE c.id = $1`, [id]);
  return row ?? null;
}

/** Names for the client picker on the opening form. */
export async function clientNames() {
  const conn = await db();
  return (await conn.query<{ name: string }>(`SELECT name FROM clients WHERE status <> 'inactive' ORDER BY lower(name)`)).map((r) => r.name);
}

/** Admins who can look after a client account. */
export async function managerOptions() {
  const conn = await db();
  return conn.query<{ id: string; name: string }>(`SELECT id, name FROM admin_users WHERE active AND role IN ('super_admin','sales','recruiter') ORDER BY name`);
}

const isDuplicate = (err: unknown) => /clients_name|unique|duplicate key/i.test(String(err));

/**
 * Creates a client (no id) or saves changes (id). A rename also updates the
 * client name on its openings, in the same transaction, so the two never drift.
 */
export async function saveClient(id: string | null, data: ClientInput, userId: string): Promise<{ id: string; changed: string[] } | "duplicate" | null> {
  const conn = await db();
  const [clash] = await conn.query<{ id: string }>(`SELECT id FROM clients WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)`, [data.name, isUuid(id) ? id : null]);
  if (clash) return "duplicate";
  const manager = data.account_manager_id ? ((await managerOptions()).some((m) => m.id === data.account_manager_id) ? data.account_manager_id : null) : null;
  try {
    if (!id) {
      const newId = randomUUID();
      await conn.tx([
        {
          text: `INSERT INTO clients (id, name, industry, website, location, status, account_manager_id, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          params: [newId, data.name, data.industry, data.website, data.location, data.status, manager, data.notes, userId],
        },
        { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'edit', 'Client added')`, params: [newId, userId] },
      ]);
      return { id: newId, changed: [] };
    }
    if (!isUuid(id)) return null;
    const before = await getClient(id);
    if (!before) return null;
    const labels: [keyof ClientInput, string][] = [
      ["name", "Name"],
      ["industry", "Industry"],
      ["website", "Website"],
      ["location", "Location"],
      ["status", "Status"],
      ["account_manager_id", "Account manager"],
      ["notes", "Notes"],
    ];
    const next = { ...data, account_manager_id: manager };
    const changed = labels.filter(([k]) => (before[k] ?? null) !== (next[k] ?? null)).map(([, l]) => l);
    if (!changed.length) return { id, changed };
    await conn.tx([
      {
        text: `UPDATE clients SET name=$2, industry=$3, website=$4, location=$5, status=$6, account_manager_id=$7, notes=$8, updated_at=now() WHERE id=$1`,
        params: [id, next.name, next.industry, next.website, next.location, next.status, next.account_manager_id, next.notes],
      },
      ...(before.name !== next.name ? [{ text: `UPDATE job_openings SET client_name = $2, updated_at = now() WHERE client_id = $1`, params: [id, next.name] }] : []),
      { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'edit', $3)`, params: [id, userId, `Updated ${changed.join(", ").toLowerCase()}`] },
    ]);
    return { id, changed };
  } catch (err) {
    if (isDuplicate(err)) return "duplicate";
    throw err;
  }
}

/** Deletes a client with no openings. Returns "has_openings" when openings still point at it. */
export async function deleteClient(id: string): Promise<{ name: string } | "has_openings" | null> {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [{ n }] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM job_openings WHERE client_id = $1`, [id]);
  if (n) return "has_openings";
  const [row] = await conn.query<{ name: string }>(`DELETE FROM clients WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM job_openings WHERE client_id = $1) RETURNING name`, [id]);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Openings linked to a client                                          */
/* ------------------------------------------------------------------ */

/**
 * SQL that finds the client named $n (creating it if new) and yields its id.
 * Used inside the opening insert and update, so the link is set atomically.
 */
export const clientIdFor = (nameParam: number, userParam: number) =>
  `client_link AS (
     INSERT INTO clients (name, created_by) SELECT $${nameParam}::text, $${userParam}::uuid WHERE $${nameParam}::text <> ''
     ON CONFLICT ((lower(name))) DO UPDATE SET updated_at = clients.updated_at RETURNING id
   )`;

export async function clientOpenings(clientId: string) {
  if (!isUuid(clientId)) return [];
  const conn = await db();
  return conn.query<ClientOpening>(
    `SELECT o.id, o.title, o.status, o.location, o.vacancies, o.created_at,
            (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id) AS applications,
            (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id AND a.status IN ('shortlisted','interview_scheduled','interview_completed','selected','offer_released')) AS in_process,
            (SELECT count(*)::int FROM applications a WHERE a.opening_id = o.id AND a.status = 'hired') AS placed
       FROM job_openings o WHERE o.client_id = $1
      ORDER BY CASE o.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, o.created_at DESC`,
    [clientId],
  );
}

/* ------------------------------------------------------------------ */
/* Contacts                                                             */
/* ------------------------------------------------------------------ */

export type ContactInput = { name: string; title: string; email: string; phone: string; is_primary: boolean };

export function parseContact(form: Record<string, unknown>): { data: ContactInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const data: ContactInput = {
    name: str(form.name, 120),
    title: str(form.title, 120),
    email: str(form.email, 200).toLowerCase(),
    phone: str(form.phone, 30),
    is_primary: form.is_primary === "on" || form.is_primary === true,
  };
  if (data.name.length < 2) errors.name = "Enter the contact's name.";
  if (data.email && !EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = "Enter a valid phone number.";
  return { data, errors };
}

export async function listContacts(clientId: string) {
  if (!isUuid(clientId)) return [];
  const conn = await db();
  return conn.query<ClientContact>(`SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, created_at`, [clientId]);
}

function contactStatements(clientId: string, contactId: string, c: ContactInput, userId: string, first: boolean): Statement[] {
  const primary = c.is_primary || first;
  return [
    ...(primary ? [{ text: `UPDATE client_contacts SET is_primary = false WHERE client_id = $1`, params: [clientId] }] : []),
    {
      text: `INSERT INTO client_contacts (id, client_id, name, title, email, phone, is_primary) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      params: [contactId, clientId, c.name, c.title, c.email, c.phone, primary],
    },
    {
      text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'contact', $3)`,
      params: [clientId, userId, `Added contact ${c.name}${c.title ? `, ${c.title}` : ""}${primary ? " (primary)" : ""}`],
    },
    { text: `UPDATE clients SET updated_at = now() WHERE id = $1`, params: [clientId] },
  ];
}

export async function addContact(clientId: string, c: ContactInput, userId: string) {
  if (!isUuid(clientId)) return null;
  const conn = await db();
  const [row] = await conn.query<{ n: number; found: boolean }>(`SELECT (SELECT count(*)::int FROM client_contacts WHERE client_id = $1) AS n, EXISTS (SELECT 1 FROM clients WHERE id = $1) AS found`, [clientId]);
  if (!row.found) return null;
  const id = randomUUID();
  await conn.tx(contactStatements(clientId, id, c, userId, row.n === 0));
  return id;
}

export async function setPrimaryContact(contactId: string, userId: string) {
  if (!isUuid(contactId)) return null;
  const conn = await db();
  const [c] = await conn.query<{ client_id: string; name: string }>(`SELECT client_id, name FROM client_contacts WHERE id = $1`, [contactId]);
  if (!c) return null;
  await conn.tx([
    { text: `UPDATE client_contacts SET is_primary = (id = $2) WHERE client_id = $1`, params: [c.client_id, contactId] },
    { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'contact', $3)`, params: [c.client_id, userId, `${c.name} is now the primary contact`] },
  ]);
  return c.client_id;
}

export async function deleteContact(contactId: string, userId: string) {
  if (!isUuid(contactId)) return null;
  const conn = await db();
  const [c] = await conn.query<{ client_id: string; name: string }>(`SELECT client_id, name FROM client_contacts WHERE id = $1`, [contactId]);
  if (!c) return null;
  await conn.tx([
    { text: `DELETE FROM client_contacts WHERE id = $1`, params: [contactId] },
    { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'contact', $3)`, params: [c.client_id, userId, `Removed contact ${c.name}`] },
  ]);
  return c.client_id;
}

/* ------------------------------------------------------------------ */
/* Requirements                                                         */
/* ------------------------------------------------------------------ */

export type RequirementInput = { title: string; sap_module: string; positions: number; needed_by: string | null; notes: string };

export function parseRequirement(form: Record<string, unknown>): { data: RequirementInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const positions = str(form.positions, 4);
  const neededBy = str(form.needed_by, 10);
  const data: RequirementInput = {
    title: str(form.title, 160),
    sap_module: str(form.sap_module, 80),
    positions: positions === "" ? 1 : Number(positions),
    needed_by: isIsoDate(neededBy) ? neededBy : null,
    notes: str(form.notes, 4000),
  };
  if (data.title.length < 2) errors.title = "Enter the role the client needs.";
  if (!Number.isInteger(data.positions) || data.positions < 1 || data.positions > 999) errors.positions = "Enter a number of positions from 1 to 999.";
  if (neededBy && !data.needed_by) errors.needed_by = "Enter a valid date.";
  return { data, errors };
}

export async function listRequirements(clientId: string) {
  if (!isUuid(clientId)) return [];
  const conn = await db();
  return conn.query<ClientRequirement>(
    `SELECT r.id, r.client_id, r.title, r.sap_module, r.positions, r.status, to_char(r.needed_by, 'YYYY-MM-DD') AS needed_by, r.notes,
            r.opening_id, o.title AS opening_title, u.name AS created_by_name, r.created_at
       FROM client_requirements r LEFT JOIN job_openings o ON o.id = r.opening_id LEFT JOIN admin_users u ON u.id = r.created_by
      WHERE r.client_id = $1
      ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END, r.needed_by NULLS LAST, r.created_at DESC`,
    [clientId],
  );
}

export async function getRequirement(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<ClientRequirement & { client_name: string }>(
    `SELECT r.id, r.client_id, c.name AS client_name, r.title, r.sap_module, r.positions, r.status, to_char(r.needed_by, 'YYYY-MM-DD') AS needed_by, r.notes, r.opening_id, r.created_at
       FROM client_requirements r JOIN clients c ON c.id = r.client_id WHERE r.id = $1`,
    [id],
  );
  return row ?? null;
}

export async function addRequirement(clientId: string, r: RequirementInput, userId: string) {
  if (!isUuid(clientId)) return null;
  const conn = await db();
  const id = randomUUID();
  const [row] = await conn.query<{ id: string }>(
    `WITH r AS (
       INSERT INTO client_requirements (id, client_id, title, sap_module, positions, needed_by, notes, created_by)
       SELECT $1, c.id, $3, $4, $5, $6::date, $7, $8 FROM clients c WHERE c.id = $2 RETURNING id, client_id
     ), e AS (
       INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $8, 'requirement', $9 FROM r
     ), t AS (
       UPDATE clients SET updated_at = now() WHERE id IN (SELECT client_id FROM r)
     )
     SELECT id FROM r`,
    [id, clientId, r.title, r.sap_module, r.positions, r.needed_by, r.notes, userId, `New requirement: ${r.positions} × ${r.title}`],
  );
  return row?.id ?? null;
}

export async function setRequirementStatus(id: string, status: string, userId: string) {
  if (!isUuid(id) || !(REQUIREMENT_STATUSES as readonly string[]).includes(status)) return null;
  const conn = await db();
  const [row] = await conn.query<{ client_id: string }>(
    `WITH r AS (UPDATE client_requirements SET status = $2, updated_at = now() WHERE id = $1 AND status <> $2 RETURNING client_id, title),
     e AS (INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $3, 'requirement', $4 || title FROM r)
     SELECT client_id FROM r`,
    [id, status, userId, `Requirement marked ${status.replace("_", " ")}: `],
  );
  return row?.client_id ?? null;
}

export async function deleteRequirement(id: string, userId: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ client_id: string }>(
    `WITH r AS (DELETE FROM client_requirements WHERE id = $1 RETURNING client_id, title),
     e AS (INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $2, 'requirement', 'Removed requirement: ' || title FROM r)
     SELECT client_id FROM r`,
    [id, userId],
  );
  return row?.client_id ?? null;
}

/** Links a requirement to the opening created for it, when both belong to the same client. */
export async function linkRequirementToOpening(requirementId: string, openingId: string, userId: string) {
  if (!isUuid(requirementId) || !isUuid(openingId)) return false;
  const conn = await db();
  const rows = await conn.query<{ id: string }>(
    `WITH r AS (
       UPDATE client_requirements r SET opening_id = o.id, updated_at = now()
         FROM job_openings o
        WHERE r.id = $1 AND o.id = $2 AND o.client_id = r.client_id
       RETURNING r.id, r.client_id, o.title
     ), e AS (
       INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $3, 'opening', 'Opening created for the requirement: ' || title FROM r
     )
     SELECT id FROM r`,
    [requirementId, openingId, userId],
  );
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* History                                                              */
/* ------------------------------------------------------------------ */

export async function addClientNote(clientId: string, body: string, userId: string) {
  if (!isUuid(clientId)) return false;
  const conn = await db();
  const rows = await conn.query<{ id: string }>(
    `WITH n AS (INSERT INTO client_events (client_id, user_id, kind, body) SELECT id, $2, 'note', $3 FROM clients WHERE id = $1 RETURNING id),
     t AS (UPDATE clients SET updated_at = now() WHERE id = $1 AND EXISTS (SELECT 1 FROM n))
     SELECT id FROM n`,
    [clientId, userId, body.slice(0, 4000)],
  );
  return rows.length > 0;
}

export async function listClientEvents(clientId: string, limit = 100) {
  if (!isUuid(clientId)) return [];
  const conn = await db();
  return conn.query<ClientEvent>(
    `SELECT e.id, e.kind, e.body, u.name AS user_name, e.created_at FROM client_events e LEFT JOIN admin_users u ON u.id = e.user_id
      WHERE e.client_id = $1 ORDER BY e.created_at DESC LIMIT $2`,
    [clientId, limit],
  );
}

/* ------------------------------------------------------------------ */
/* From a website enquiry                                               */
/* ------------------------------------------------------------------ */

export async function clientForEnquiry(enquiryId: string) {
  if (!isUuid(enquiryId)) return null;
  const conn = await db();
  const [row] = await conn.query<{ id: string; name: string }>(`SELECT id, name FROM clients WHERE enquiry_id = $1 ORDER BY created_at LIMIT 1`, [enquiryId]);
  return row ?? null;
}

/**
 * Makes a prospect from an enquiry: the company (or the person, if no company
 * was given) becomes the client and the person its primary contact. When a
 * client with that name already exists, the contact is added there instead.
 */
export async function createClientFromEnquiry(enquiryId: string, userId: string): Promise<{ id: string; existed: boolean } | null> {
  if (!isUuid(enquiryId)) return null;
  const conn = await db();
  const [e] = await conn.query<{ number: string; name: string; company: string; email: string; phone: string; service: string; requirement: string; message: string }>(
    `SELECT number::text, name, company, email, phone, service, requirement, message FROM enquiries WHERE id = $1`,
    [enquiryId],
  );
  if (!e) return null;
  const name = (e.company.trim() || e.name.trim()).slice(0, 160);
  const contact: ContactInput = { name: e.name.slice(0, 120), title: "", email: EMAIL_RE.test(e.email) ? e.email.slice(0, 200) : "", phone: e.phone.slice(0, 30), is_primary: false };
  const [existing] = await conn.query<{ id: string; has_contact: boolean; contacts: number }>(
    `SELECT c.id, EXISTS (SELECT 1 FROM client_contacts k WHERE k.client_id = c.id AND lower(k.email) = lower($2) AND $2 <> '') AS has_contact,
            (SELECT count(*)::int FROM client_contacts k WHERE k.client_id = c.id) AS contacts
       FROM clients c WHERE lower(c.name) = lower($1)`,
    [name, contact.email],
  );
  const summary = [e.service && `Service: ${e.service}`, e.requirement && `Requirement: ${e.requirement}`, e.message].filter(Boolean).join("\n").slice(0, 3800);
  if (existing) {
    await conn.tx([
      ...(existing.has_contact ? [] : contactStatements(existing.id, randomUUID(), contact, userId, existing.contacts === 0)),
      { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'note', $3)`, params: [existing.id, userId, `From website enquiry #${e.number}:\n${summary}`] },
    ]);
    return { id: existing.id, existed: true };
  }
  const id = randomUUID();
  try {
    await conn.tx([
      {
        text: `INSERT INTO clients (id, name, status, enquiry_id, notes, created_by) VALUES ($1, $2, 'prospect', $3, $4, $5)`,
        params: [id, name, enquiryId, `From website enquiry #${e.number}.`, userId],
      },
      { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'edit', $3)`, params: [id, userId, `Client added from website enquiry #${e.number}`] },
      ...contactStatements(id, randomUUID(), contact, userId, true),
      { text: `INSERT INTO client_events (client_id, user_id, kind, body) VALUES ($1, $2, 'note', $3)`, params: [id, userId, `From website enquiry #${e.number}:\n${summary}`] },
    ]);
  } catch (err) {
    // Someone created the same client a moment ago.
    if (isDuplicate(err)) return createClientFromEnquiry(enquiryId, userId);
    throw err;
  }
  return { id, existed: false };
}

/** The client an opening is linked to (admin only; never part of the public opening columns). */
export async function clientOfOpening(openingId: string) {
  if (!isUuid(openingId)) return null;
  const conn = await db();
  const [row] = await conn.query<{ id: string; name: string }>(`SELECT c.id, c.name FROM job_openings o JOIN clients c ON c.id = o.client_id WHERE o.id = $1`, [openingId]);
  return row ?? null;
}
