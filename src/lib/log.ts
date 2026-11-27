/**
 * Structured server logs: one JSON object per line, so Vercel's log search
 * (or any log drain) can filter by event and level. Never pass personal data
 * (names, emails, phones) or secrets as fields; use record ids instead.
 */
type Level = "info" | "warn" | "error";

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
