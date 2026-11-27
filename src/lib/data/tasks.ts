import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { CANDIDATE_PRIORITIES, istToday, type CandidatePriority } from "./constants";
import { isIsoDate } from "@/lib/dates";

/**
 * To-dos for the team: "call the candidate back on Friday", "send Acme the shortlist".
 * A task has one owner and may point at a candidate (or one of their
 * applications), a job opening or a client.
 */

const isUuid = (v?: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v?: string | null) => isIsoDate(v);

export type Task = {
  id: string;
  title: string;
  notes: string;
  owner_id: string;
  owner_name: string;
  created_by: string | null;
  created_by_name: string | null;
  due_on: string | null;
  priority: CandidatePriority;
  status: "open" | "done";
  candidate_id: string | null;
  candidate_name: string | null;
  application_id: string | null;
  application_number: string | null;
  opening_id: string | null;
  opening_title: string | null;
  client_id: string | null;
  client_name: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TaskInput = {
  title: string;
  notes: string;
  owner_id: string;
  due_on: string | null;
  priority: CandidatePriority;
  candidate_id: string | null;
  application_id: string | null;
  opening_id: string | null;
  client_id: string | null;
};

export function parseTask(form: Record<string, unknown>, fallbackOwner: string): { data: TaskInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const due = str(form.due_on, 10);
  const priority = str(form.priority, 10);
  const id = (k: string) => (isUuid(str(form[k], 40)) ? str(form[k], 40) : null);
  const data: TaskInput = {
    title: str(form.title, 200),
    notes: str(form.notes, 4000),
    owner_id: id("owner_id") ?? fallbackOwner,
    due_on: due && isDate(due) ? due : null,
    priority: (CANDIDATE_PRIORITIES as readonly string[]).includes(priority) ? (priority as CandidatePriority) : "normal",
    candidate_id: id("candidate_id"),
    application_id: id("application_id"),
    opening_id: id("opening_id"),
    client_id: id("client_id"),
  };
  if (!data.title) errors.title = "Say what needs doing.";
  if (due && !data.due_on) errors.due_on = "Enter a valid date.";
  return { data, errors };
}

const SELECT = `SELECT t.id, t.title, t.notes, t.owner_id, ow.name AS owner_name, t.created_by, cb.name AS created_by_name,
    to_char(t.due_on, 'YYYY-MM-DD') AS due_on, t.priority, t.status, t.candidate_id, c.full_name AS candidate_name,
    t.application_id, a.number::text AS application_number, t.opening_id, o.title AS opening_title, t.client_id, cl.name AS client_name,
    t.completed_at, t.created_at
  FROM tasks t JOIN admin_users ow ON ow.id = t.owner_id LEFT JOIN admin_users cb ON cb.id = t.created_by
  LEFT JOIN candidates c ON c.id = t.candidate_id LEFT JOIN applications a ON a.id = t.application_id
  LEFT JOIN job_openings o ON o.id = t.opening_id LEFT JOIN clients cl ON cl.id = t.client_id`;

export type TaskFilters = {
  /** An admin's id, or undefined for everyone. */
  owner?: string;
  status?: "open" | "done";
  due?: "overdue" | "today" | "week" | "none";
  candidate?: string;
  opening?: string;
  client?: string;
};

export async function listTasks(f: TaskFilters, limit = 200) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (isUuid(f.owner)) add((n) => `t.owner_id = $${n}::uuid`, f.owner);
  if (f.status) add((n) => `t.status = $${n}`, f.status);
  const today = istToday();
  if (f.due === "overdue") add((n) => `t.due_on < $${n}::date`, today);
  else if (f.due === "today") add((n) => `t.due_on = $${n}::date`, today);
  else if (f.due === "week") add((n) => `t.due_on BETWEEN $${n}::date AND $${n}::date + 6`, today);
  else if (f.due === "none") where.push(`t.due_on IS NULL`);
  if (isUuid(f.candidate)) add((n) => `t.candidate_id = $${n}::uuid`, f.candidate);
  if (isUuid(f.opening)) add((n) => `t.opening_id = $${n}::uuid`, f.opening);
  if (isUuid(f.client)) add((n) => `t.client_id = $${n}::uuid`, f.client);
  params.push(limit);
  return conn.query<Task>(
    `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.status, CASE WHEN t.status = 'open' THEN t.due_on END NULLS LAST,
               CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.completed_at DESC NULLS LAST, t.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

/** Open, overdue and due-today counts for one person (or everyone). */
export async function taskCounts(ownerId?: string) {
  const conn = await db();
  const [r] = await conn.query<{ open: number; overdue: number; today: number }>(
    `SELECT count(*)::int AS open,
            count(*) FILTER (WHERE due_on < $1::date)::int AS overdue,
            count(*) FILTER (WHERE due_on = $1::date)::int AS today
       FROM tasks WHERE status = 'open' AND ($2::uuid IS NULL OR owner_id = $2::uuid)`,
    [istToday(), isUuid(ownerId) ? ownerId : null],
  );
  return { open: Number(r.open), overdue: Number(r.overdue), today: Number(r.today) };
}

export async function getTask(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<Task>(`${SELECT} WHERE t.id = $1`, [id]);
  return row ?? null;
}

/** Active admins a task can be given to. */
export async function taskOwnerOptions() {
  const conn = await db();
  return conn.query<{ id: string; name: string }>(`SELECT id, name FROM admin_users WHERE active ORDER BY name`);
}

/**
 * Creates a task. Links that don't exist are dropped; an application brings its
 * candidate with it. The candidate's or client's history notes it, in the same statement.
 */
export async function createTask(t: TaskInput, userId: string) {
  const conn = await db();
  const id = randomUUID();
  const [row] = await conn.query<{ id: string }>(
    `WITH ap AS (SELECT id, candidate_id FROM applications WHERE id = $8::uuid),
     ins AS (
       INSERT INTO tasks (id, title, notes, owner_id, created_by, due_on, priority, application_id, candidate_id, opening_id, client_id)
       SELECT $1, $2, $3, u.id, $5, $6::date, $7, (SELECT id FROM ap),
              COALESCE((SELECT candidate_id FROM ap), (SELECT id FROM candidates WHERE id = $9::uuid)),
              (SELECT id FROM job_openings WHERE id = $10::uuid), (SELECT id FROM clients WHERE id = $11::uuid)
         FROM admin_users u WHERE u.id = $4::uuid AND u.active
       RETURNING id, candidate_id, application_id, client_id, owner_id
     ),
     ce AS (
       INSERT INTO application_events (candidate_id, application_id, user_id, kind, body, details)
       SELECT candidate_id, application_id, $5, 'task', $12, jsonb_build_object('task_id', id) FROM ins WHERE candidate_id IS NOT NULL
     ),
     ke AS (
       INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $5, 'task', $12 FROM ins WHERE client_id IS NOT NULL
     )
     SELECT id FROM ins`,
    [id, t.title, t.notes, t.owner_id, userId, t.due_on, t.priority, t.application_id, t.candidate_id, t.opening_id, t.client_id, `Task added: ${t.title}`.slice(0, 300)],
  );
  return row?.id ?? null;
}

export async function updateTask(id: string, t: Pick<TaskInput, "title" | "notes" | "owner_id" | "due_on" | "priority">) {
  if (!isUuid(id)) return false;
  const conn = await db();
  const rows = await conn.query<{ id: string }>(
    `UPDATE tasks SET title = $2, notes = $3, owner_id = COALESCE((SELECT id FROM admin_users WHERE id = $4::uuid AND active), owner_id),
            due_on = $5::date, priority = $6, reminded_on = NULL, updated_at = now()
      WHERE id = $1 RETURNING id`,
    [id, t.title, t.notes, t.owner_id, t.due_on, t.priority],
  );
  return rows.length > 0;
}

/** Ticks a task off (or reopens it). Returns false when it was already in that state. */
export async function setTaskDone(id: string, done: boolean, userId: string) {
  if (!isUuid(id)) return false;
  const conn = await db();
  const rows = await conn.query<{ id: string }>(
    `WITH t AS (
       UPDATE tasks SET status = $2, completed_at = CASE WHEN $2 = 'done' THEN now() END, completed_by = CASE WHEN $2 = 'done' THEN $3::uuid END, updated_at = now()
        WHERE id = $1 AND status <> $2 RETURNING id, title, candidate_id, application_id, client_id
     ),
     ce AS (
       INSERT INTO application_events (candidate_id, application_id, user_id, kind, body, details)
       SELECT candidate_id, application_id, $3, 'task', $4 || title, jsonb_build_object('task_id', id) FROM t WHERE candidate_id IS NOT NULL
     ),
     ke AS (INSERT INTO client_events (client_id, user_id, kind, body) SELECT client_id, $3, 'task', $4 || title FROM t WHERE client_id IS NOT NULL)
     SELECT id FROM t`,
    [id, done ? "done" : "open", userId, done ? "Task done: " : "Task reopened: "],
  );
  return rows.length > 0;
}

export async function deleteTask(id: string) {
  if (!isUuid(id)) return null;
  const conn = await db();
  const [row] = await conn.query<{ title: string }>(`DELETE FROM tasks WHERE id = $1 RETURNING title`, [id]);
  return row?.title ?? null;
}

/* ------------------------------------------------------------------ */
/* Daily reminders                                                      */
/* ------------------------------------------------------------------ */

/**
 * Claims today's reminders: open tasks due today or earlier, and candidate
 * follow-ups that have come due. Each is claimed once per day (tasks) or once
 * per follow-up date (candidates), so overlapping cron runs never repeat one.
 */
export async function claimDueReminders(today = istToday()) {
  const conn = await db();
  const tasks = await conn.query<{ owner_id: string; overdue: number; due_today: number }>(
    `WITH claimed AS (
       UPDATE tasks SET reminded_on = $1::date
        WHERE status = 'open' AND due_on <= $1::date AND (reminded_on IS NULL OR reminded_on < $1::date)
       RETURNING owner_id, due_on
     )
     SELECT owner_id, count(*) FILTER (WHERE due_on < $1::date)::int AS overdue, count(*) FILTER (WHERE due_on = $1::date)::int AS due_today
       FROM claimed GROUP BY owner_id`,
    [today],
  );
  const followUps = await conn.query<{ owner_id: string; n: number }>(
    `WITH claimed AS (
       UPDATE candidates SET follow_up_reminded_on = $1::date
        WHERE owner_id IS NOT NULL AND follow_up_on <= $1::date AND (follow_up_reminded_on IS NULL OR follow_up_reminded_on < follow_up_on)
       RETURNING owner_id
     )
     SELECT owner_id, count(*)::int AS n FROM claimed GROUP BY owner_id`,
    [today],
  );
  return {
    tasks: tasks.map((r) => ({ owner_id: r.owner_id, overdue: Number(r.overdue), due_today: Number(r.due_today) })),
    followUps: followUps.map((r) => ({ owner_id: r.owner_id, count: Number(r.n) })),
  };
}
