import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Hardening milestone H2: access and security controls (H-06, H-07, M-11,
 * M-12, M-14, M-15, M-18, M-19, L-21).
 */

process.env.DB_DRIVER = "pglite";
delete process.env.PGLITE_DIR;
delete process.env.MAIL_TRANSPORT;
delete process.env.CV_STORAGE;
delete process.env.BLOB_READ_WRITE_TOKEN;

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "192.0.2.10", "user-agent": "vitest" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { db } = await import("@/lib/db/client");
const users = await import("@/lib/data/users");
const session = await import("@/lib/auth/session");
const totp = await import("@/lib/auth/totp");
const mfa = await import("@/lib/data/mfa");
const apps = await import("@/lib/data/applications");
const candidates = await import("@/lib/data/candidates");
const openings = await import("@/lib/data/openings");

let ownerId = "";
const uuid = () => crypto.randomUUID();

beforeAll(async () => {
  await db();
  ownerId = await users.createAdmin({ email: "h2.owner@example.test", name: "H2 Owner", role: "super_admin", password: "h2-owner-pass-42", mustChange: false });
});

describe("H-06: two-step sign-in", () => {
  it("matches the RFC 6238 test values", () => {
    const secret = totp.base32Encode(Buffer.from("12345678901234567890"));
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totp.totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totp.totpAt(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totp.totpAt(secret, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totp.base32Decode(secret).toString()).toBe("12345678901234567890");
    // One step of drift either way, never an older or already used step.
    const now = 1_700_000_000_000;
    const step = totp.currentStep(now);
    expect(totp.verifyTotp(secret, totp.totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(totp.verifyTotp(secret, totp.totpAt(secret, step - 2), null, now)).toBeNull();
    expect(totp.verifyTotp(secret, totp.totpAt(secret, step), step, now)).toBeNull();
    expect(totp.verifyTotp(secret, "12345", null, now)).toBeNull();
  });

  it("asks for a code after the password, refuses wrong and reused codes, and accepts a recovery code once", async () => {
    const id = await users.createAdmin({ email: "h2.mfa@example.test", name: "H2 Mfa", role: "recruiter", password: "h2-mfa-pass-42", mustChange: false });
    const pending = await mfa.beginMfaSetup(id);
    expect(await mfa.confirmMfaSetup(id, "000000")).toBeNull();
    const codes = await mfa.confirmMfaSetup(id, totp.totpAt(pending, totp.currentStep()));
    expect(codes).toHaveLength(10);

    jar.clear();
    const first = await session.signIn("h2.mfa@example.test", "h2-mfa-pass-42");
    expect(first).toEqual({ ok: true, needsCode: true });
    expect(jar.has(session.SESSION_COOKIE)).toBe(false);
    expect(await session.currentAdmin()).toBeNull();

    const wrong = await session.verifySecondStep("123456");
    expect(wrong.ok).toBe(false);
    // The code that confirmed setup was already used, so it can't sign in again.
    expect((await session.verifySecondStep(totp.totpAt(pending, totp.currentStep()))).ok).toBe(false);

    const conn = await db();
    // Use a code for the next step (allowed for clock drift) so it hasn't been used yet.
    const next = totp.totpAt(pending, totp.currentStep() + 1);
    const ok = await session.verifySecondStep(next);
    expect(ok).toMatchObject({ ok: true, needsCode: false });
    expect(jar.has(session.SESSION_COOKIE)).toBe(true);
    const outcomes = await conn.query<{ outcome: string }>(`SELECT outcome FROM login_events WHERE user_id = $1 ORDER BY created_at`, [id]);
    expect(outcomes.map((o) => o.outcome)).toEqual(["mfa_failed", "mfa_failed", "success"]);

    // A recovery code works once.
    jar.clear();
    await session.signIn("h2.mfa@example.test", "h2-mfa-pass-42");
    expect((await session.verifySecondStep(codes![0].replace("-", ""))).ok).toBe(true);
    jar.clear();
    await session.signIn("h2.mfa@example.test", "h2-mfa-pass-42");
    expect((await session.verifySecondStep(codes![0])).ok).toBe(false);
    expect((await mfa.mfaStatus(id))?.codesLeft).toBe(9);
  });

  it("ends the challenge after five wrong codes", async () => {
    jar.clear();
    await session.signIn("h2.mfa@example.test", "h2-mfa-pass-42");
    let last;
    for (let i = 0; i < 5; i++) last = await session.verifySecondStep("000000");
    expect(last).toMatchObject({ ok: false, error: expect.stringMatching(/email and password again/) });
    expect(await session.pendingChallenge()).toBe(false);
    expect((await session.verifySecondStep("000001")).ok).toBe(false);
  });

  it("can't be required for Super Admins by someone who hasn't turned it on", async () => {
    jar.clear();
    expect((await session.signIn("h2.owner@example.test", "h2-owner-pass-42")).ok).toBe(true);
    const { saveSettingsAction } = await import("@/app/admin/actions/settings");
    const { getSettings } = await import("@/lib/data/settings");
    const base = await getSettings();
    const f = new FormData();
    f.set("applicationsEmail", base.applicationsEmail);
    f.set("enquiriesEmail", base.enquiriesEmail);
    f.set("auditRetentionDays", String(base.auditRetentionDays));
    f.set("requireMfaForSuperAdmins", "on");
    expect((await saveSettingsAction({}, f)).error).toMatch(/your own account first/);
    expect((await getSettings()).requireMfaForSuperAdmins).toBe(false);
  });
});

describe("L-21: idle sessions end", () => {
  it("signs out a session with no activity for 60 minutes", async () => {
    jar.clear();
    await session.signIn("h2.owner@example.test", "h2-owner-pass-42");
    expect((await session.currentAdmin())?.id).toBe(ownerId);
    const conn = await db();
    await conn.query(`UPDATE admin_sessions SET last_seen_at = now() - interval '61 minutes' WHERE user_id = $1`, [ownerId]);
    expect(await session.currentAdmin()).toBeNull();
  });
});

describe("M-14: rate limits are shared", () => {
  it("counts in the database, stores no IP, and refuses the sixth attempt", async () => {
    const { rateLimit } = await import("@/lib/guard");
    const key = "203.0.113.77";
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await rateLimit(key));
    expect(results.map((r) => r.limited)).toEqual([false, false, false, false, false, true]);
    const conn = await db();
    const rows = await conn.query<{ key: string; hits: number }>(`SELECT key, hits FROM rate_limits`);
    expect(rows.some((r) => r.key.includes("203.0.113"))).toBe(false);
    expect(rows.some((r) => Number(r.hits) === 6)).toBe(true);
  });
});

describe("M-15: two people editing one profile", () => {
  it("refuses a save made from an older version and says who changed it", async () => {
    const a = await apps.recordApplication({ candidate: { email: "h2.edit@example.test", fullName: "Edit Tester" }, source: "careers", position: "SAP Basis", experience: "", submissionKey: uuid() });
    const c = await candidates.getCandidate(a.candidateId);
    const input = (o: Record<string, string>) => candidates.parseCandidate({ full_name: c!.full_name, phone: "", location: "", ...o }).data;
    const v = Number(c!.version);
    expect(await candidates.updateCandidate(c!.id, input({ location: "Pune" }), ownerId, { expectedVersion: v })).toEqual({ changed: ["Location"] });
    // A second person still has the form open at the old version.
    const stale = await candidates.updateCandidate(c!.id, input({ location: "Chennai" }), ownerId, { expectedVersion: v });
    expect(stale).toMatchObject({ conflict: { by: "H2 Owner" } });
    const after = await candidates.getCandidate(c!.id);
    expect(after?.location).toBe("Pune");
    expect(Number(after?.version)).toBe(v + 1);
    // Priority, owner and follow-up changes don't count as profile edits.
    await candidates.setCandidateFields(c!.id, { priority: "high" }, ownerId);
    expect(Number((await candidates.getCandidate(c!.id))?.version)).toBe(v + 1);
  });
});

describe("M-18: a candidate email is sent once per compose form", () => {
  it("claims the send under the form's key and frees it again if sending failed", async () => {
    const { claimEmail, finishEmail } = await import("@/lib/data/email");
    const a = await apps.recordApplication({ candidate: { email: "h2.mail@example.test", fullName: "Mail Tester" }, source: "careers", position: "SAP Basis", experience: "", submissionKey: uuid() });
    const m = { candidateId: a.candidateId, applicationId: null, templateId: null, to: "h2.mail@example.test", subject: "Hello", body: "Hi", userId: ownerId, key: `${ownerId}:${uuid()}` };
    const first = await claimEmail(m);
    expect(first).toBeTruthy();
    expect(await claimEmail(m)).toBeNull();
    await finishEmail(first!, m, { status: "failed", error: "smtp down" });
    const retry = await claimEmail(m);
    expect(retry).toBeTruthy();
    await finishEmail(retry!, m, { status: "sent" });
    expect(await claimEmail(m)).toBeNull();
    const conn = await db();
    const rows = await conn.query<{ status: string }>(`SELECT status FROM email_messages WHERE candidate_id = $1 ORDER BY created_at`, [a.candidateId]);
    expect(rows.map((r) => r.status)).toEqual(["failed", "sent"]);
  });
});

describe("M-12 and M-19: contact details and data export", () => {
  it("masks contact details for roles that don't contact candidates", async () => {
    const { can } = await import("@/lib/auth/permissions");
    const { maskEmail, maskPhone } = await import("@/lib/mask");
    expect(["super_admin", "recruiter", "sales", "viewer"].map((r) => can(r, "candidates.contact"))).toEqual([true, true, false, false]);
    expect(["super_admin", "recruiter", "sales", "viewer"].map((r) => can(r, "candidates.export"))).toEqual([true, false, false, false]);
    expect(maskEmail("test.candidate@example.test")).toBe("te•••@example.test");
    expect(maskPhone("+91 90000 12345")).toBe("•••• 45");
    expect(maskPhone("")).toBe("");
  });

  it("exports everything held about one candidate, without the confidential client", async () => {
    const opening = await openings.createOpening(
      openings.parseOpening({
        title: "SAP MM Consultant",
        sap_module: "MM",
        client_name: "Secret Client H2 Ltd",
        public_client_label: "A Global Manufacturer",
        location: "Pune",
        work_mode: "Hybrid",
        experience: "3–5 years",
        employment_type: "Permanent",
        salary_range: "",
        summary: "MM rollout.",
        description: "Configure MM for a global rollout across several plants and support the cutover.",
        skills: "SAP MM",
        status: "published",
        closing_date: "",
      }).data,
      ownerId,
    );
    const a = await apps.recordApplication({ candidate: { email: "h2.export@example.test", fullName: "Export Tester", phone: "+91 90000 77777" }, openingId: opening, source: "job", position: "SAP MM Consultant", experience: "3–5 years", details: { consentVersion: "x" }, submissionKey: uuid() });
    await apps.addApplicationNote(a.id, "Good MM background", ownerId);
    const data = await candidates.exportCandidateData(a.candidateId);
    expect(data?.profile).toMatchObject({ email: "h2.export@example.test", full_name: "Export Tester", phone: "+91 90000 77777" });
    expect(data?.applications).toHaveLength(1);
    expect(data?.applications[0]).toMatchObject({ employer: "A Global Manufacturer", opening_title: "SAP MM Consultant" });
    expect(JSON.stringify(data)).not.toContain("Secret Client H2");
    expect(JSON.stringify(data?.timeline)).toContain("Good MM background");
    expect(await candidates.exportCandidateData("not-a-uuid")).toBeNull();
  });
});

describe("H-07 and M-11: consent and the content security policy", () => {
  it("requires consent on the job application form", async () => {
    const { validateApplication } = await import("@/lib/forms");
    const file = { size: 1000, type: "application/pdf", name: "cv.pdf" };
    const base = { fullName: "Consent Tester", email: "consent@example.test", phone: "+91 90000 88888", position: "Other", experience: "3–5 years" };
    expect(validateApplication(base, file).errors.consent).toBeTruthy();
    expect(validateApplication({ ...base, consent: "yes" }, file).errors.consent).toBeUndefined();
  });

  it("sends a CSP on pages but not on file routes", async () => {
    const config = (await import("../next.config")).default;
    const rules = await config.headers!();
    const csp = rules.find((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
    expect(csp).toBeTruthy();
    const value = csp!.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(value).toMatch(/default-src 'self'/);
    expect(value).toMatch(/object-src 'none'/);
    expect(value).toMatch(/frame-ancestors 'self'/);
    const re = new RegExp(`^${csp!.source.replace("(?!", "(?!").replace(/\/:path\*/, "/.*")}$`);
    expect(re.test("/careers")).toBe(true);
    expect(re.test("/admin/applications")).toBe(true);
    expect(re.test("/admin/api/resume/x")).toBe(false);
    expect(re.test("/api/cv")).toBe(false);
  });
});
