import "server-only";
import { db } from "@/lib/db/client";
import { isIsoDate } from "@/lib/dates";

/**
 * The audit trail: every sign-in attempt, who looked at client and candidate
 * records, and filters over the activity log. Writing an audit entry never
 * breaks the action being audited; a failure is logged and skipped.
 */

export const LOGIN_OUTCOMES = ["success", "bad_password", "mfa_failed", "locked", "unknown", "inactive", "rate_limited", "signout"] as const;
export type LoginOutcome = (typeof LOGIN_OUTCOMES)[number];
export const LOGIN_OUTCOME_LABELS: Record<LoginOutcome, string> = {
  success: "Signed in",
  bad_password: "Wrong password",
  mfa_failed: "Wrong two-step code",
  locked: "Blocked: account locked",
  unknown: "No such account",
  inactive: "Blocked: account deactivated",
  rate_limited: "Blocked: too many attempts",
  signout: "Signed out",
};

const isUuid = (v?: string | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);
/** Someone may type a password into the email box; keep only what looks like an address. */
const typedEmail = (v: string) => {
  const e = v.trim().toLowerCase().slice(0, 200);
  return /^[^\s@]+@[^\s@]+$/.test(e) ? e : "(not an email address)";
};

export async function recordLogin(e: { userId?: string | null; email: string; outcome: LoginOutcome; ip?: string; userAgent?: string }) {
  try {
    const conn = await db();
    await conn.query(`INSERT INTO login_events (user_id, email, outcome, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`, [
      isUuid(e.userId) ? e.userId : null,
      typedEmail(e.email),
      e.outcome,
      (e.ip ?? "").slice(0, 64),
      (e.userAgent ?? "").slice(0, 300),
    ]);
  } catch (err) {
    console.error("[audit] could not record a sign-in", err instanceof Error ? err.message : err);
  }
}

/**
 * Records that someone opened a record with personal or confidential data.
 * One entry per person and record every 30 minutes, so browsing around a
 * profile doesn't flood the log.
 */
export async function logView(userId: string, entity: "client" | "candidate", entityId: string, summary: string) {
  if (!isUuid(entityId)) return;
  try {
    const conn = await db();
    await conn.query(
      `INSERT INTO activity_log (user_id, action, entity, entity_id, summary)
       SELECT $1, 'view', $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE user_id = $1 AND action = 'view' AND entity = $2 AND entity_id = $3 AND created_at > now() - interval '30 minutes')`,
      [userId, entity, entityId, summary.slice(0, 500)],
    );
  } catch (err) {
    console.error("[audit] could not record a view", err instanceof Error ? err.message : err);
  }
}

/* ------------------------------------------------------------------ */
/* Reading the trail                                                    */
/* ------------------------------------------------------------------ */

export type AuditFilters = { user?: string; action?: string; entity?: string; entityId?: string; q?: string; from?: string; to?: string };
export type ActivityRow = { id: string; action: string; entity: string; entity_id: string | null; summary: string; created_at: string; user_id: string | null; user_name: string | null };

function dateRange(col: string, f: { from?: string; to?: string }, params: unknown[], where: string[]) {
  if (isIsoDate(f.from)) {
    params.push(f.from);
    where.push(`${col} >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
  if (isIsoDate(f.to)) {
    params.push(f.to);
    where.push(`${col} < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
}

function activityWhere(f: AuditFilters) {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (isUuid(f.user)) add((n) => `a.user_id = $${n}::uuid`, f.user);
  if (f.action && /^[a-z_]{1,30}$/.test(f.action)) add((n) => `a.action = $${n}`, f.action);
  if (f.entity && /^[a-z_]{1,30}$/.test(f.entity)) add((n) => `a.entity = $${n}`, f.entity);
  if (f.entityId && /^[0-9a-f-]{36}$/i.test(f.entityId)) add((n) => `a.entity_id = $${n}`, f.entityId);
  if (f.q?.trim()) add((n) => `a.summary ILIKE $${n}`, `%${f.q.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  dateRange("a.created_at", f, params, where);
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listActivity(f: AuditFilters = {}, { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const conn = await db();
  const { sql, params } = activityWhere(f);
  const rows = await conn.query<ActivityRow>(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.created_at, a.user_id, u.name AS user_name
       FROM activity_log a LEFT JOIN admin_users u ON u.id = a.user_id ${sql}
      ORDER BY a.created_at DESC, a.id LIMIT ${Math.min(10_000, Math.max(1, limit))} OFFSET ${Math.max(0, offset)}`,
    params,
  );
  const [{ count }] = await conn.query<{ count: number }>(`SELECT count(*)::int AS count FROM activity_log a ${sql}`, params);
  return { rows, total: Number(count) };
}

/** The actions and record types that appear in the log, for the filter menus. */
export async function activityFacets() {
  const conn = await db();
  const [actions, entities, users] = await Promise.all([
    conn.query<{ v: string }>(`SELECT DISTINCT action AS v FROM activity_log ORDER BY 1`),
    conn.query<{ v: string }>(`SELECT DISTINCT entity AS v FROM activity_log ORDER BY 1`),
    conn.query<{ id: string; name: string; active: boolean }>(`SELECT id, name, active FROM admin_users ORDER BY active DESC, name`),
  ]);
  return { actions: actions.map((r) => r.v), entities: entities.map((r) => r.v), users };
}

export type LoginFilters = { user?: string; outcome?: string; q?: string; from?: string; to?: string };
export type LoginRow = { id: string; user_id: string | null; user_name: string | null; email: string; outcome: LoginOutcome; ip: string; user_agent: string; created_at: string };

export async function listLogins(f: LoginFilters = {}, { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const conn = await db();
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: (n: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (isUuid(f.user)) add((n) => `l.user_id = $${n}::uuid`, f.user);
  if (f.outcome === "failed") where.push(`l.outcome NOT IN ('success','signout')`);
  else if ((LOGIN_OUTCOMES as readonly string[]).includes(f.outcome ?? "")) add((n) => `l.outcome = $${n}`, f.outcome);
  if (f.q?.trim()) add((n) => `(l.email ILIKE $${n} OR l.ip ILIKE $${n})`, `%${f.q.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  dateRange("l.created_at", f, params, where);
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await conn.query<LoginRow>(
    `SELECT l.id, l.user_id, u.name AS user_name, l.email, l.outcome, l.ip, l.user_agent, l.created_at
       FROM login_events l LEFT JOIN admin_users u ON u.id = l.user_id ${sql}
      ORDER BY l.created_at DESC, l.id LIMIT ${Math.min(10_000, Math.max(1, limit))} OFFSET ${Math.max(0, offset)}`,
    params,
  );
  const [c] = await conn.query<{ total: number; failed: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE l.outcome NOT IN ('success','signout'))::int AS failed FROM login_events l ${sql}`,
    params,
  );
  return { rows, total: Number(c.total), failed: Number(c.failed) };
}

/** Failed sign-ins in the last day, for the Activity page header. */
export async function recentFailedLogins() {
  const conn = await db();
  const [r] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM login_events WHERE outcome NOT IN ('success','signout') AND created_at > now() - interval '24 hours'`);
  return Number(r.n);
}

/* ------------------------------------------------------------------ */
/* Retention                                                            */
/* ------------------------------------------------------------------ */

export const RETENTION_MIN_DAYS = 90;
export const RETENTION_MAX_DAYS = 3650;
export const RETENTION_DEFAULT_DAYS = 730;

/**
 * Deletes audit entries older than the retention period, and read
 * notifications older than 180 days. Returns how many rows went.
 */
export async function pruneAudit(days: number) {
  const keep = Math.min(RETENTION_MAX_DAYS, Math.max(RETENTION_MIN_DAYS, Math.round(Number(days) || RETENTION_DEFAULT_DAYS)));
  const conn = await db();
  const [r] = await conn.query<{ activity: number; logins: number; notifications: number }>(
    `WITH a AS (DELETE FROM activity_log WHERE created_at < now() - ($1::int * interval '1 day') RETURNING 1),
          l AS (DELETE FROM login_events WHERE created_at < now() - ($1::int * interval '1 day') RETURNING 1),
          n AS (DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < now() - interval '180 days' RETURNING 1)
     SELECT (SELECT count(*) FROM a)::int AS activity, (SELECT count(*) FROM l)::int AS logins, (SELECT count(*) FROM n)::int AS notifications`,
    [keep],
  );
  return { keepDays: keep, activity: Number(r.activity), logins: Number(r.logins), notifications: Number(r.notifications) };
}
