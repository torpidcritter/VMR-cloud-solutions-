import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, isDbConfigured } from "@/lib/db/client";
import { MIGRATIONS } from "@/lib/db/migrations";
import { isStorageConfigured, storageDriver } from "@/lib/cv-storage";
import { isMailConfigured } from "@/lib/mailer";
import { outboxStats } from "@/lib/data/outbox";
import { errorMessage, log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The same secret as the daily job unlocks the detailed view, for monitoring. */
function detailed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  return timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

/**
 * Health check for an uptime monitor (H-08). 200 when the site can take
 * submissions, 503 when the database is down or its schema is behind the
 * code. The public answer says only that; with the cron secret it also
 * reports storage, email and the queue of emails waiting to be retried.
 */
export async function GET(req: Request) {
  const started = Date.now();
  const latest = MIGRATIONS[MIGRATIONS.length - 1].version;
  let database: "ok" | "down" | "not_configured" = "not_configured";
  let schema: "current" | "behind" | "unknown" = "unknown";
  let outbox: { pending: number; gaveUp: number } | null = null;
  if (isDbConfigured()) {
    try {
      const conn = await db();
      const [r] = await conn.query<{ v: number }>(`SELECT max(version)::int AS v FROM schema_migrations`);
      database = "ok";
      schema = Number(r.v) >= latest ? "current" : "behind";
      outbox = await outboxStats().catch(() => null);
    } catch (err) {
      database = "down";
      log("error", "health.database_down", { error: errorMessage(err) });
    }
  }
  const ok = database !== "down" && schema !== "behind";
  const body: Record<string, unknown> = { status: ok ? "ok" : "down", database, schema, time: new Date().toISOString() };
  if (detailed(req)) {
    Object.assign(body, {
      schemaVersion: latest,
      storage: isStorageConfigured() ? storageDriver() : "not_configured",
      email: isMailConfigured() ? "configured" : "not_configured",
      outbox,
      responseMs: Date.now() - started,
    });
  }
  return NextResponse.json(body, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
