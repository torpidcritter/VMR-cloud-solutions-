import { mkdtempSync } from "node:fs";
import { readdir, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { docx, pdf } from "./helpers/files";

/**
 * Hardening milestone H1: data integrity and file safety. Each block starts
 * from the defect the audit found (C-01, C-02, H-03, H-04, H-05, M-10, M-16,
 * L-22) and checks it can no longer happen.
 */

process.env.DB_DRIVER = "pglite";
delete process.env.PGLITE_DIR;
delete process.env.MAIL_TRANSPORT;
delete process.env.SMTP_HOST;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
const storeDir = mkdtempSync(path.join(os.tmpdir(), "h1-files-"));
process.env.CV_STORAGE = "local";
process.env.CV_LOCAL_DIR = storeDir;

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// Lets a test close an opening after the careers route's first check and before its save.
const race = vi.hoisted(() => ({ afterLiveCheck: null as null | ((id: string) => Promise<void>) }));
vi.mock("@/lib/data/openings", async (orig) => {
  const m = await orig<typeof import("@/lib/data/openings")>();
  return {
    ...m,
    getLiveOpeningById: async (id: string) => {
      const live = await m.getLiveOpeningById(id);
      if (race.afterLiveCheck) await race.afterLiveCheck(id);
      return live;
    },
  };
});

const { db } = await import("@/lib/db/client");
const users = await import("@/lib/data/users");
const openings = await import("@/lib/data/openings");
const apps = await import("@/lib/data/applications");
const { canMoveApplication, nextStages, APPLICATION_STATUSES } = await import("@/lib/data/constants");
const storage = await import("@/lib/cv-storage");

const opening = {
  title: "SAP Basis Consultant",
  sap_module: "Basis",
  client_name: "Hardening Test Client",
  public_client_label: "Global IT Services Company",
  location: "Pune",
  work_mode: "Hybrid",
  experience: "3–5 years",
  employment_type: "Permanent",
  salary_range: "",
  summary: "Run S/4HANA landscapes.",
  description: "You will run and upgrade S/4HANA landscapes and support cutover weekends for a large programme.",
  skills: "SAP Basis, HANA",
  status: "published",
  closing_date: "",
};

let adminId = "";
let openingId = "";
const uuid = () => crypto.randomUUID();

beforeAll(async () => {
  await db();
  adminId = await users.createAdmin({ email: "h1.owner@example.test", name: "H1 Owner", role: "super_admin", password: "h1-owner-pass-42", mustChange: false });
  openingId = await openings.createOpening(openings.parseOpening(opening).data, adminId);
});

describe("C-01: a public form never overwrites a profile", () => {
  it("keeps the existing name and phone, fills only empty fields, and records what was typed", async () => {
    const first = await apps.recordApplication({
      candidate: { email: "test.owner@example.test", fullName: "Test Candidate", phone: "+91 90000 22222" },
      source: "careers",
      position: "SAP Basis",
      experience: "3–5 years",
      submissionKey: uuid(),
    });
    // Someone else types the same email with a different name and phone.
    const second = await apps.recordApplication({
      candidate: { email: "TEST.owner@example.test", fullName: "Somebody Else", phone: "+91 90000 99999", location: "Chennai" },
      source: "cv_upload",
      position: "SAP HANA",
      experience: "5–8 years",
      submissionKey: uuid(),
    });
    expect(second.candidateId).toBe(first.candidateId);
    expect(second.repeat).toBe(true);
    const conn = await db();
    const [c] = await conn.query<{ full_name: string; phone: string; location: string }>(`SELECT full_name, phone, location FROM candidates WHERE id = $1`, [first.candidateId]);
    expect(c).toEqual({ full_name: "Test Candidate", phone: "+91 90000 22222", location: "Chennai" });
    const [a] = await conn.query<{ details: Record<string, string> }>(`SELECT details FROM applications WHERE id = $1`, [second.id]);
    expect(a.details).toMatchObject({ submittedName: "Somebody Else", submittedPhone: "+91 90000 99999" });

    // The same name in another case, and the same number formatted differently, are not flagged.
    const third = await apps.recordApplication({
      candidate: { email: "test.owner@example.test", fullName: "test candidate", phone: "+91-90000-22222" },
      source: "careers",
      position: "SAP Basis Lead",
      experience: "3–5 years",
      submissionKey: uuid(),
    });
    const [b] = await conn.query<{ details: Record<string, string> }>(`SELECT details FROM applications WHERE id = $1`, [third.id]);
    expect(b.details.submittedName).toBeUndefined();
    expect(b.details.submittedPhone).toBeUndefined();
  });
});

describe("H-04: one submission is saved once", () => {
  it("returns the first application for a repeated submission key, even when both arrive together", async () => {
    const key = uuid();
    const input = {
      candidate: { email: "double.click@example.test", fullName: "Double Click", phone: "+91 90000 33333" },
      source: "careers" as const,
      position: "SAP Basis",
      experience: "3–5 years",
      submissionKey: key,
    };
    const [x, y] = await Promise.all([apps.recordApplication(input), apps.recordApplication(input)]);
    expect(x.id).toBe(y.id);
    expect([x.duplicate, y.duplicate].sort()).toEqual([false, true]);
    const again = await apps.recordApplication({ ...input, submissionKey: key.toUpperCase() });
    expect(again).toMatchObject({ id: x.id, duplicate: true });
    const conn = await db();
    const [n] = await conn.query<{ n: number }>(`SELECT count(*)::int AS n FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE c.email = 'double.click@example.test'`);
    expect(Number(n.n)).toBe(1);
  });

  it("treats the same person, role and opening within minutes as one when the form sends no key", async () => {
    const input = { candidate: { email: "no.key@example.test", fullName: "No Key" }, openingId, source: "job" as const, position: opening.title, experience: "3–5 years" };
    const a = await apps.recordApplication(input);
    const b = await apps.recordApplication({ ...input, submissionKey: "not-a-uuid" });
    expect(b).toMatchObject({ id: a.id, duplicate: true });
    // A different role is a different application.
    const c = await apps.recordApplication({ ...input, openingId: null, source: "careers", position: "SAP HANA" });
    expect(c.duplicate).toBe(false);
  });
});

describe("L-22: an opening that closes during a submission takes no application", () => {
  it("refuses once the opening is paused or past its closing date", async () => {
    const id = await openings.createOpening(openings.parseOpening({ ...opening, title: "SAP Basis Closing Soon" }).data, adminId);
    const input = { candidate: { email: "late.applicant@example.test", fullName: "Late Applicant" }, openingId: id, source: "job" as const, position: "SAP Basis Closing Soon", experience: "" };
    await openings.updateOpening(id, openings.parseOpening({ ...opening, title: "SAP Basis Closing Soon", status: "paused" }).data);
    await expect(apps.recordApplication({ ...input, submissionKey: uuid() })).rejects.toBeInstanceOf(apps.OpeningClosedError);
    const conn = await db();
    // Nothing was kept about the applicant: not even a profile.
    expect(await conn.query(`SELECT 1 FROM candidates WHERE email = 'late.applicant@example.test'`)).toHaveLength(0);
    await conn.query(`UPDATE job_openings SET status = 'published', closing_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - 1 WHERE id = $1`, [id]);
    await expect(apps.recordApplication({ ...input, submissionKey: uuid() })).rejects.toBeInstanceOf(apps.OpeningClosedError);
    // The closing day itself still counts (IST).
    await conn.query(`UPDATE job_openings SET closing_date = (now() AT TIME ZONE 'Asia/Kolkata')::date WHERE id = $1`, [id]);
    expect((await apps.recordApplication({ ...input, submissionKey: uuid() })).duplicate).toBe(false);
  });
});

describe("H-05: stage changes follow the hiring process", () => {
  it("allows Hired only after an interview, selection or offer, and undoing it only for a super admin", () => {
    for (const from of APPLICATION_STATUSES) {
      const ok = canMoveApplication(from, "hired");
      expect(ok).toBe(from === "interview_completed" || from === "selected" || from === "offer_released");
    }
    expect(nextStages("hired")).toEqual([]);
    expect(nextStages("hired", true)).toEqual(["offer_released"]);
    expect(canMoveApplication("rejected", "screening")).toBe(true);
    expect(canMoveApplication("rejected", "offer_released")).toBe(false);
    expect(canMoveApplication("new", "new")).toBe(false);
  });

  it("applies the same rules to bulk changes and keeps Hired applications from being deleted", async () => {
    const { bulkSetStatus } = await import("@/lib/data/bulk");
    const made = [];
    for (const n of [1, 2, 3]) {
      made.push(await apps.recordApplication({ candidate: { email: `bulk.rule${n}@example.test`, fullName: `Bulk Rule ${n}` }, source: "careers", position: "SAP Basis", experience: "", submissionKey: uuid() }));
    }
    expect(await apps.setApplicationStatus(made[0].id, "selected", adminId)).toBe(true);
    // Only the one that reached Selected may become Hired; the two new ones are skipped.
    expect(await bulkSetStatus(made.map((m) => m.id), "hired", adminId)).toBe(1);
    expect((await apps.getApplication(made[1].id))?.status).toBe("new");
    expect(await bulkSetStatus([made[0].id], "screening", adminId)).toBe(0);
    expect(await bulkSetStatus([made[0].id], "offer_released", adminId, { superAdmin: true })).toBe(1);
    expect(await apps.setApplicationStatus(made[0].id, "hired", adminId)).toBe(true);

    expect(await apps.deleteApplication(made[0].id)).toBeNull();
    expect(await apps.getApplication(made[0].id)).toBeTruthy();
    await apps.deleteApplication(made[1].id);
    expect(await apps.getApplication(made[1].id)).toBeNull();
  });
});

describe("M-10: the audit trail can't be edited or cut short", () => {
  it("refuses edits and early deletes, but lets an account's removal clear its link", async () => {
    const conn = await db();
    const temp = await users.createAdmin({ email: "h1.temp@example.test", name: "H1 Temp", role: "viewer", password: "h1-temp-pass-42", mustChange: false });
    await conn.query(`INSERT INTO activity_log (user_id, action, entity, summary) VALUES ($1, 'update', 'task', 'h1 recent')`, [temp]);
    await conn.query(`INSERT INTO login_events (user_id, email, outcome) VALUES ($1, 'h1.temp@example.test', 'success')`, [temp]);
    await expect(conn.query(`UPDATE activity_log SET summary = 'edited' WHERE summary = 'h1 recent'`)).rejects.toThrow(/cannot be changed/);
    await expect(conn.query(`UPDATE activity_log SET created_at = now() - interval '1000 days' WHERE summary = 'h1 recent'`)).rejects.toThrow(/cannot be changed/);
    await expect(conn.query(`UPDATE login_events SET outcome = 'bad_password' WHERE user_id = $1`, [temp])).rejects.toThrow(/cannot be changed/);
    await expect(conn.query(`DELETE FROM activity_log WHERE summary = 'h1 recent'`)).rejects.toThrow(/at least 90 days/);
    await expect(conn.query(`DELETE FROM login_events WHERE user_id = $1`, [temp])).rejects.toThrow(/at least 90 days/);

    // Removing the account sets user_id to NULL on its entries (ON DELETE SET NULL), which is allowed.
    await conn.query(`DELETE FROM admin_users WHERE id = $1`, [temp]);
    const [row] = await conn.query<{ user_id: string | null; summary: string }>(`SELECT user_id, summary FROM activity_log WHERE summary = 'h1 recent'`);
    expect(row).toEqual({ user_id: null, summary: "h1 recent" });

    // Entries past the minimum can go (the retention job).
    await conn.query(`INSERT INTO activity_log (action, entity, summary, created_at) VALUES ('update', 'task', 'h1 old', now() - interval '91 days')`);
    await conn.query(`DELETE FROM activity_log WHERE summary = 'h1 old'`);
    expect(await conn.query(`SELECT 1 FROM activity_log WHERE summary = 'h1 old'`)).toHaveLength(0);
  });
});

describe("C-02 and M-16: stored files", () => {
  const exists = (p: string) =>
    stat(path.join(storeDir, p)).then(
      () => true,
      () => false,
    );

  it("deleting an Upload CV application removes its form record and folder too", async () => {
    const stored = await storage.storeCv({ file: pdf(), ext: "pdf", contentType: "application/pdf", record: { candidate: { fullName: "Erase Me", email: "erase.me@example.test" } } });
    expect(await exists(stored.recordPath)).toBe(true);
    await storage.deleteStoredFile(stored.cvPath);
    await storage.deleteSubmissionRecord(stored.cvPath);
    expect(await exists(stored.recordPath)).toBe(false);
    expect(await exists(path.dirname(stored.cvPath))).toBe(false);
    // Anything that isn't an Upload CV path is ignored.
    await storage.deleteSubmissionRecord("../../etc/passwd");
    await storage.deleteSubmissionRecord("applications/2026/11/x/cv.pdf");
  });

  it("sweeps only old files that nothing points to, never Upload CV folders", async () => {
    const { sweepOrphanFiles } = await import("@/lib/data/files");
    const old = new Date(Date.now() - 3 * 86400_000);
    const kept = await storage.storeResume({ file: pdf(), ext: "pdf", contentType: "application/pdf" });
    const orphan = await storage.storeResume({ file: pdf(), ext: "pdf", contentType: "application/pdf" });
    const fresh = await storage.storeResume({ file: pdf(), ext: "pdf", contentType: "application/pdf" });
    const cv = await storage.storeCv({ file: pdf(), ext: "pdf", contentType: "application/pdf", record: {} });
    for (const p of [kept.path, orphan.path, cv.cvPath, cv.recordPath]) await utimes(path.join(storeDir, p), old, old);
    await apps.recordApplication({
      candidate: { email: "has.resume@example.test", fullName: "Has Resume" },
      source: "careers",
      position: "SAP Basis",
      experience: "",
      resume: { path: kept.path, name: "cv.pdf", size: 100, type: "application/pdf" },
      submissionKey: uuid(),
    });
    const r = await sweepOrphanFiles();
    expect(r.deleted).toBe(1);
    expect(await exists(orphan.path)).toBe(false);
    for (const p of [kept.path, fresh.path, cv.cvPath, cv.recordPath]) expect(await exists(p)).toBe(true);
  });

  it("deletes nothing when most files look unreferenced (wrong database)", async () => {
    const { sweepOrphanFiles } = await import("@/lib/data/files");
    const old = new Date(Date.now() - 3 * 86400_000);
    const before = (await storage.listStoredFiles()).length;
    for (let i = 0; i < before + 12; i++) {
      const s = await storage.storeResume({ file: pdf(), ext: "pdf", contentType: "application/pdf" });
      await utimes(path.join(storeDir, s.path), old, old);
    }
    const all = (await storage.listStoredFiles()).length;
    const r = await sweepOrphanFiles();
    expect(r.deleted).toBe(0);
    expect(r.skipped).toMatch(/not deleting anything/);
    expect((await storage.listStoredFiles()).length).toBe(all);
  });
});

describe("H-03 and H-04 on the job application form", () => {
  let ip = 0;
  const request = (fields: Record<string, string>, file: { bytes: Buffer; name: string; type: string }) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    fd.set("resume", new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
    return new Request("https://vmrcloudsolutions.com/api/careers", { method: "POST", body: fd, headers: { "x-forwarded-for": `10.9.0.${++ip}` } });
  };
  const fields = (extra: Record<string, string> = {}) => ({
    fullName: "Form Tester",
    email: "form.tester@example.test",
    phone: "+91 90000 44444",
    position: "Other",
    experience: "3–5 years",
    message: "",
    startedAt: String(Date.now() - 60_000),
    website: "",
    consent: "yes",
    ...extra,
  });
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const resumes = async () => {
    try {
      return (await readdir(path.join(storeDir, "applications"), { recursive: true })).filter((f) => /\.(pdf|docx?)$/.test(String(f))).length;
    } catch {
      return 0;
    }
  };

  it("refuses a Word file with macros and a file whose contents don't match its type", async () => {
    const { POST } = await import("@/app/api/careers/route");
    const before = await resumes();
    const macro = await POST(request(fields(), { bytes: docx(["word/vbaProject.bin"]), name: "cv.docx", type: DOCX }));
    expect(macro.status).toBe(422);
    expect((await macro.json()).errors.resume).toMatch(/macros/);
    const fake = await POST(request(fields(), { bytes: docx(), name: "cv.pdf", type: "application/pdf" }));
    expect(fake.status).toBe(422);
    expect(await resumes()).toBe(before);
  });

  it("saves a double-submitted application once and keeps only one resume", async () => {
    const { POST } = await import("@/app/api/careers/route");
    const submissionId = uuid();
    const before = await resumes();
    const first = await POST(request(fields({ submissionId }), { bytes: pdf(), name: "cv.pdf", type: "application/pdf" }));
    const second = await POST(request(fields({ submissionId }), { bytes: pdf(), name: "cv.pdf", type: "application/pdf" }));
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await resumes()).toBe(before + 1);
    const conn = await db();
    const rows = await conn.query<{ resume_path: string }>(
      `SELECT a.resume_path FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE c.email = 'form.tester@example.test'`,
    );
    expect(rows).toHaveLength(1);
    expect(await stat(path.join(storeDir, rows[0].resume_path)).then(() => true)).toBe(true);
  });

  it("answers 410 and keeps no resume when the opening closed while the form was open", async () => {
    const id = await openings.createOpening(openings.parseOpening({ ...opening, title: "SAP Basis Race" }).data, adminId);
    // The route's first check passes; the opening closes before the save.
    race.afterLiveCheck = async (oid) => {
      const conn = await db();
      await conn.query(`UPDATE job_openings SET status = 'paused' WHERE id = $1`, [oid]);
    };
    try {
      const { POST } = await import("@/app/api/careers/route");
      const before = await resumes();
      const res = await POST(request(fields({ openingId: id, email: "race.tester@example.test", submissionId: uuid() }), { bytes: pdf(), name: "cv.pdf", type: "application/pdf" }));
      expect(res.status).toBe(410);
      expect(await resumes()).toBe(before);
      const conn = await db();
      expect(await conn.query(`SELECT 1 FROM candidates WHERE email = 'race.tester@example.test'`)).toHaveLength(0);
    } finally {
      race.afterLiveCheck = null;
    }
  });
});
