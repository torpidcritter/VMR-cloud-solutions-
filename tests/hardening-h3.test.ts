import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pdf } from "./helpers/files";

/**
 * Hardening milestone H3: operations and recovery (H-08, M-17), and what
 * happens to a submission when the database or the mail server fails.
 */

process.env.DB_DRIVER = "pglite";
delete process.env.PGLITE_DIR;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
process.env.CV_STORAGE = "local";
process.env.CV_LOCAL_DIR = mkdtempSync(path.join(os.tmpdir(), "h3-files-"));
process.env.MAIL_TRANSPORT = "log";
process.env.CRON_SECRET = "h3-cron-secret-123456";

const sendMail = vi.fn();
vi.mock("@/lib/mailer", async (orig) => ({ ...(await orig<typeof import("@/lib/mailer")>()), sendMail: (...a: unknown[]) => sendMail(...a) }));
const failSave = { on: false };
vi.mock("@/lib/data/applications", async (orig) => {
  const m = await orig<typeof import("@/lib/data/applications")>();
  return { ...m, recordApplication: (...a: Parameters<typeof m.recordApplication>) => (failSave.on ? Promise.reject(new Error("database unavailable")) : m.recordApplication(...a)) };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { db } = await import("@/lib/db/client");
const outbox = await import("@/lib/data/outbox");

beforeAll(async () => {
  await db();
});
beforeEach(() => {
  sendMail.mockReset().mockResolvedValue(undefined);
  failSave.on = false;
});

let ip = 0;
function careers(fields: Record<string, string> = {}) {
  const fd = new FormData();
  const all = {
    fullName: "Recovery Tester",
    email: `recovery.${++ip}@example.test`,
    phone: "+91 90000 31313",
    position: "Other",
    experience: "3–5 years",
    message: "",
    startedAt: String(Date.now() - 60_000),
    website: "",
    consent: "yes",
    submissionId: crypto.randomUUID(),
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) fd.set(k, v);
  fd.set("resume", new File([new Uint8Array(pdf())], "cv.pdf", { type: "application/pdf" }));
  return new Request("https://vmrcloudsolutions.com/api/careers", { method: "POST", body: fd, headers: { "x-forwarded-for": `10.31.0.${ip}` } });
}

describe("M-17: emails to the team are retried, not lost", () => {
  it("queues the email when sending fails and the submission was saved, then sends it with the resume", async () => {
    const { POST } = await import("@/app/api/careers/route");
    sendMail.mockRejectedValueOnce(new Error("SMTP timeout"));
    const res = await POST(careers());
    expect(res.status).toBe(200);
    expect(await outbox.outboxStats()).toEqual({ pending: 1, gaveUp: 0 });

    // Not due yet: nothing is sent.
    expect(await outbox.retryOutbox()).toEqual({ tried: 0, sent: 0, failed: 0 });
    const conn = await db();
    await conn.query(`UPDATE notification_outbox SET next_attempt_at = now()`);
    // Two runs at once send it once.
    const [a, b] = await Promise.all([outbox.retryOutbox(), outbox.retryOutbox()]);
    expect(a.sent + b.sent).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(2); // the failed first try and the retry
    const retried = sendMail.mock.calls[1][0];
    expect(retried.subject).toMatch(/^Job application: Other/);
    expect(retried.attachments[0].content.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await outbox.outboxStats()).toEqual({ pending: 0, gaveUp: 0 });
  });

  it("backs off after each failure and gives up after the last attempt", async () => {
    await outbox.queueMail({ kind: "test", ref: "x", mail: { to: "hr@example.test", subject: "S", text: "T", html: "<p>T</p>" }, error: "first" });
    const conn = await db();
    sendMail.mockRejectedValue(new Error("still down"));
    for (let i = 0; i < outbox.MAX_ATTEMPTS; i++) {
      await conn.query(`UPDATE notification_outbox SET next_attempt_at = now() WHERE kind = 'test'`);
      await outbox.retryOutbox();
    }
    const [row] = await conn.query<{ attempts: number; last_error: string; sent_at: string | null }>(`SELECT attempts, last_error, sent_at FROM notification_outbox WHERE kind = 'test'`);
    expect(Number(row.attempts)).toBe(outbox.MAX_ATTEMPTS);
    expect(row).toMatchObject({ last_error: "still down", sent_at: null });
    expect(await outbox.outboxStats()).toEqual({ pending: 0, gaveUp: 1 });
  });
});

describe("Recovery: the database or the mail server is down", () => {
  it("still delivers an application by email when the database save fails", async () => {
    const { POST } = await import("@/app/api/careers/route");
    failSave.on = true;
    const res = await POST(careers());
    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0].attachments).toHaveLength(1);
  });

  it("tells the applicant to try again when neither the database nor email works", async () => {
    const { POST } = await import("@/app/api/careers/route");
    failSave.on = true;
    sendMail.mockRejectedValue(new Error("SMTP down"));
    const res = await POST(careers());
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });
});

describe("H-08: health check and structured logs", () => {
  it("reports healthy without details publicly, and with details for the monitor", async () => {
    const { GET } = await import("@/app/api/health/route");
    const pub = await GET(new Request("https://x.test/api/health"));
    expect(pub.status).toBe(200);
    expect(pub.headers.get("cache-control")).toBe("no-store");
    const body = await pub.json();
    expect(body).toMatchObject({ status: "ok", database: "ok", schema: "current" });
    expect(body.storage).toBeUndefined();
    const full = await (await GET(new Request("https://x.test/api/health", { headers: { authorization: "Bearer h3-cron-secret-123456" } }))).json();
    expect(full).toMatchObject({ storage: "local", email: "configured", outbox: { pending: 0 } });
  });

  it("answers 503 when the schema is behind the code", async () => {
    const { GET } = await import("@/app/api/health/route");
    const conn = await db();
    await conn.query(`DELETE FROM schema_migrations WHERE version = (SELECT max(version) FROM schema_migrations)`);
    try {
      const res = await GET(new Request("https://x.test/api/health"));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ status: "down", schema: "behind" });
    } finally {
      const { MIGRATIONS } = await import("@/lib/db/migrations");
      await conn.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [MIGRATIONS[MIGRATIONS.length - 1].version]);
    }
  });

  it("writes one JSON object per log line", async () => {
    const { log } = await import("@/lib/log");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "test.event", { ref: "#12" });
    const line = JSON.parse(String(spy.mock.calls[0][0]));
    expect(line).toMatchObject({ level: "error", event: "test.event", ref: "#12" });
    expect(Date.parse(line.time)).not.toBeNaN();
    spy.mockRestore();
  });
});
