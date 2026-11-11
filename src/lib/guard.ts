import "server-only";

/** Simple spam protection: honeypot, minimum fill time and per-IP rate limit. */

const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
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
