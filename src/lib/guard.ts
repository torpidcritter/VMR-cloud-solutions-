import "server-only";
import { createHash } from "node:crypto";
import { db, isDbConfigured } from "@/lib/db/client";

/** Simple spam protection: honeypot, minimum fill time and per-IP rate limit. */

const memory = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MAX = 5;

/**
 * Counts an attempt for `key` (an IP, or "admin-login:" + IP) and says
 * whether it is over the limit of 5 in 10 minutes. With a database the count
 * is shared by every server instance (on Vercel each instance would
 * otherwise count on its own); keys are stored hashed, never as IPs. If the
 * database can't be reached, this instance's memory is used instead.
 */
export async function rateLimit(key: string): Promise<{ limited: boolean; hits: number }> {
  if (isDbConfigured()) {
    try {
      const conn = await db();
      const [r] = await conn.query<{ hits: number }>(
        `INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / 600) * 600), 1)
         ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
         RETURNING hits`,
        [createHash("sha256").update(key).digest("hex").slice(0, 40)],
      );
      const hits = Number(r.hits);
      return { limited: hits > RATE_LIMIT_MAX, hits };
    } catch (err) {
      console.error("[guard] shared rate limit unavailable, using memory", err instanceof Error ? err.message : err);
    }
  }
  const now = Date.now();
  const recent = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  memory.set(key, recent);
  if (memory.size > 5000) memory.clear();
  return { limited: recent.length > RATE_LIMIT_MAX, hits: recent.length };
}

export async function rateLimited(key: string) {
  return (await rateLimit(key)).limited;
}

export function looksLikeBot(honeypot: unknown, startedAt: unknown) {
  if (typeof honeypot === "string" && honeypot.trim() !== "") return true;
  const t = Number(startedAt);
  if (!Number.isFinite(t)) return true;
  const elapsed = Date.now() - t;
  return elapsed < 2500 || elapsed > 1000 * 60 * 60 * 24;
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/**
 * True when a browser request comes from this site. Browsers always send
 * Origin on POST from fetch/XHR, so a missing or foreign Origin means the
 * request did not come from our own form.
 */
export function sameOrigin(headers: Headers) {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
