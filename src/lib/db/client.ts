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
export type Statement = { text: string; params?: unknown[] };
export type Db = {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs the statements in one transaction: all of them apply, or none do. */
  tx(statements: Statement[]): Promise<Row[][]>;
};

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
      async tx(statements: Statement[]) {
        return pg.transaction(async (t) => {
          const out: Row[][] = [];
          for (const st of statements) out.push(normalise<Row>((await t.query<Row>(st.text, st.params ?? [])).rows));
          return out;
        });
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
    async tx(statements: Statement[]) {
      if (!statements.length) return [];
      const results = (await sql.transaction(statements.map((st) => sql.query(st.text, st.params ?? [])))) as unknown[][];
      return results.map((r) => normalise<Row>(r));
    },
  };
}

async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    if (m.version === 1) {
      // The original schema: every statement is idempotent.
      for (const statement of m.statements) await db.query(statement);
      await db.query(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, [m.version]);
      continue;
    }
    // Later migrations apply atomically. If two servers race, the second one's
    // insert into schema_migrations fails, its transaction rolls back, and the
    // next request finds the migration already applied.
    await db.tx([...m.statements.map((text) => ({ text })), { text: `INSERT INTO schema_migrations (version) VALUES ($1)`, params: [m.version] }]);
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
