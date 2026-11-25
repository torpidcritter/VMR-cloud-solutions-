import "server-only";
import { MIGRATIONS } from "./migrations";

/**
 * Database access for the website and the admin panel.
 *
 * Production (Vercel): a Neon Postgres database connected to the project.
 * Vercel adds DATABASE_URL automatically when the Neon integration is linked.
 *
 * Local development and tests: DB_DRIVER=pglite runs an embedded Postgres
 * (in memory, or on disk when PGLITE_DIR is set). No server needed.
 *
 * The schema is created and upgraded automatically on first use, so a
 * freshly connected database needs no manual setup.
 */

export type Row = Record<string, unknown>;
export type Db = { query<T = Row>(text: string, params?: unknown[]): Promise<T[]> };

export class DbNotConfiguredError extends Error {}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function isDbConfigured() {
  return process.env.DB_DRIVER === "pglite" || Boolean(databaseUrl());
}

/** Both drivers may return Date objects for timestamps; the app works with ISO strings. */
function normalise<T>(rows: unknown[]): T[] {
  for (const row of rows as Record<string, unknown>[]) {
    for (const k in row) if (row[k] instanceof Date) row[k] = (row[k] as Date).toISOString();
  }
  return rows as T[];
}

type Global = typeof globalThis & { __vmrDb?: Promise<Db> };
const g = globalThis as Global;

async function connect(): Promise<Db> {
  if (process.env.DB_DRIVER === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR || undefined);
    return {
      async query<T>(text: string, params: unknown[] = []) {
        const res = await pg.query<T>(text, params);
        return normalise<T>(res.rows);
      },
    };
  }
  const url = databaseUrl();
  if (!url) throw new DbNotConfiguredError("DATABASE_URL is not set");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return normalise<T>((await sql.query(text, params)) as unknown[]);
    },
  };
}

async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    for (const statement of m.statements) await db.query(statement);
    await db.query(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, [m.version]);
  }
}

/** The shared connection, with the schema guaranteed up to date. */
export function db(): Promise<Db> {
  if (!g.__vmrDb) {
    g.__vmrDb = connect().then(async (conn) => {
      await migrate(conn);
      return conn;
    });
    g.__vmrDb.catch(() => {
      g.__vmrDb = undefined;
    });
  }
  return g.__vmrDb;
}

/** Test helper: forget the connection so the next call starts fresh. */
export function resetDbForTests() {
  g.__vmrDb = undefined;
}
