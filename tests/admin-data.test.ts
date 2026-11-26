import { beforeAll, describe, expect, it, vi } from "vitest";

// In-memory Postgres for every test in this file.
process.env.DB_DRIVER = "pglite";
delete process.env.PGLITE_DIR;

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { db } = await import("@/lib/db/client");
const users = await import("@/lib/data/users");
const session = await import("@/lib/auth/session");
const openings = await import("@/lib/data/openings");
const apps = await import("@/lib/data/applications");
const enquiries = await import("@/lib/data/enquiries");
const { dashboardStats } = await import("@/lib/data/dashboard");

const opening = {
  title: "SAP S/4HANA FICO Consultant",
  sap_module: "FICO",
  client_name: "Confidential Client Ltd",
  public_client_label: "Leading Global IT Services MNC",
  location: "Bengaluru",
  work_mode: "Hybrid",
  experience: "3–5 years",
  employment_type: "Permanent",
  salary_range: "",
  summary: "Join an S/4HANA finance transformation.",
  description: "You will configure FI/CO for a large S/4HANA programme and support testing and cutover.",
  skills: "SAP FI, SAP CO, S/4HANA",
  status: "published",
  closing_date: "",
};

beforeAll(async () => {
  await db();
});

describe("schema", () => {
  it("applies migrations once and records the version", async () => {
    const conn = await db();
    const rows = await conn.query<{ version: number }>(`SELECT version FROM schema_migrations ORDER BY version`);
    expect(rows.map((r) => Number(r.version))).toEqual([1, 2]);
  });
});

describe("admin accounts and sign-in", () => {
  it("creates only one first admin", async () => {
    expect(await users.countAdmins()).toBe(0);
    const id = await users.createFirstAdmin({ email: "Owner@Example.com", name: "Owner", password: "correct-horse-42" });
    expect(id).toBeTruthy();
    expect(await users.createFirstAdmin({ email: "second@example.com", name: "Second", password: "another-pass-42" })).toBeNull();
  });

  it("signs in with the right password and sets a session cookie", async () => {
    const res = await session.signIn("owner@example.com", "correct-horse-42");
    expect(res.ok).toBe(true);
    expect(jar.get(session.SESSION_COOKIE)).toBeTruthy();
    const me = await session.currentAdmin();
    expect(me?.role).toBe("super_admin");
  });

  it("rejects a wrong password with a generic message and locks after 5 tries", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await session.signIn("owner@example.com", "wrong-password-1");
      expect(r.ok).toBe(false);
    }
    const locked = await session.signIn("owner@example.com", "correct-horse-42");
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/Too many attempts/);
    // A Super Admin reset clears the lock.
    const [u] = await users.listAdmins();
    await users.setPassword(u.id, "correct-horse-42", false);
    expect((await session.signIn("owner@example.com", "correct-horse-42")).ok).toBe(true);
  });

  it("enforces roles on the server", async () => {
    await users.createAdmin({ email: "viewer@example.com", name: "Viewer", role: "viewer", password: "viewer-pass-42", mustChange: true });
    await session.signIn("viewer@example.com", "viewer-pass-42");
    await expect(session.assertAdmin("applications.export")).rejects.toThrow(/role/);
    await expect(session.assertAdmin("applications.view")).resolves.toMatchObject({ role: "viewer", mustChangePassword: true });
    await session.signOut();
    expect(await session.currentAdmin()).toBeNull();
    await expect(session.requireAdmin()).rejects.toThrow("REDIRECT /admin/login");
  });

  it("refuses duplicate emails", async () => {
    await expect(users.createAdmin({ email: "VIEWER@example.com", name: "Dup", role: "viewer", password: "x-pass-12345", mustChange: true })).rejects.toThrow(/already exists/);
  });
});

describe("openings, applications and the public site", () => {
  let openingId = "";

  it("validates and creates an opening; the public view hides the client", async () => {
    const bad = openings.parseOpening({ ...opening, title: "", description: "short" });
    expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(["title", "description"]));
    const { data, errors } = openings.parseOpening(opening);
    expect(errors).toEqual({});
    const [admin] = await users.listAdmins();
    openingId = await openings.createOpening(data, admin.id);
    const pub = await openings.listPublicOpenings();
    expect(pub).toHaveLength(1);
    expect(pub[0]).not.toHaveProperty("client_name");
    expect(JSON.stringify(pub[0])).not.toContain("Confidential Client Ltd");
    expect(await openings.getPublicOpening(pub[0].slug)).toMatchObject({ title: opening.title });
  });

  it("hides paused and expired openings from the website", async () => {
    await openings.setOpeningStatus(openingId, "paused");
    expect(await openings.listPublicOpenings()).toHaveLength(0);
    await openings.setOpeningStatus(openingId, "published");
    const { data } = openings.parseOpening({ ...opening, closing_date: "2020-01-01" });
    await openings.updateOpening(openingId, data);
    expect(await openings.listPublicOpenings()).toHaveLength(0);
    await openings.updateOpening(openingId, openings.parseOpening(opening).data);
    expect(await openings.listPublicOpenings()).toHaveLength(1);
  });

  it("records applications, links repeat candidates and filters them", async () => {
    const a1 = await apps.recordApplication({
      candidate: { email: "Priya@Example.com", fullName: "Priya Sharma", phone: "+91 98765 43210", location: "Bengaluru" },
      openingId,
      source: "job",
      position: opening.title,
      experience: "3–5 years",
      resume: { path: "applications/x/cv.pdf", name: "cv.pdf", size: 1000, type: "application/pdf" },
    });
    expect(a1.repeat).toBe(false);
    const a2 = await apps.recordApplication({
      candidate: { email: "priya@example.com", fullName: "Priya Sharma", specialisation: "SAP FICO" },
      source: "cv_upload",
      position: "SAP FICO",
      experience: "5–8 years",
    });
    expect(a2.repeat).toBe(true);
    expect(a2.candidateId).toBe(a1.candidateId);

    const all = await apps.listApplications({});
    expect(all.stats).toMatchObject({ total: 2, new: 2, resumes: 1 });
    expect((await apps.listApplications({ client: "Confidential Client Ltd" })).rows).toHaveLength(1);
    expect((await apps.listApplications({ q: "priya" })).rows).toHaveLength(2);
    expect((await apps.listApplications({ q: `#${a2.number}` })).rows).toHaveLength(1);
    expect((await apps.listApplications({ source: "cv_upload" })).rows).toHaveLength(1);

    const [admin] = await users.listAdmins();
    expect(await apps.setApplicationStatus(a1.id, "shortlisted", admin.id)).toBe(true);
    await apps.addApplicationNote(a1.id, "Strong FI background", admin.id);
    const detail = await apps.getApplication(a1.id);
    expect(detail?.events.map((e) => e.kind).sort()).toEqual(["note", "status"]);
    expect(detail?.others).toHaveLength(1);
    expect((await apps.listApplications({ status: "shortlisted" })).rows).toHaveLength(1);

    const talent = await apps.listTalent({ q: "priya" });
    expect(talent.total).toBe(1);
    expect(talent.rows[0]).toMatchObject({ applications: 2, has_resume: true, specialisation: "SAP FICO" });
  });

  it("records enquiries and counts everything on the dashboard", async () => {
    await enquiries.recordEnquiry({ name: "Arun", company: "Acme", email: "arun@acme.test", phone: "999", service: "Contract SAP Recruitment", requirement: "", message: "Need 3 FICO contractors" });
    const list = await enquiries.listEnquiries({ q: "acme" });
    expect(list.rows).toHaveLength(1);
    const stats = await dashboardStats();
    expect(stats.applications.total).toBe(2);
    expect(stats.openings.published).toBe(1);
    expect(stats.talent.candidates).toBe(1);
    expect(stats.enquiries.new).toBe(1);
    expect(stats.weekly).toHaveLength(12);
    expect(stats.weekly.at(-1)?.count).toBe(2);
  });
});

describe("ATS: candidates, pipeline and job openings", () => {
  const candidates = () => import("@/lib/data/candidates");
  let adminId = "";
  let recruiterId = "";
  let openingId = "";

  beforeAll(async () => {
    const [admin] = await users.listAdmins();
    adminId = admin.id;
    await users.createAdmin({ email: "recruiter@example.test", name: "Test Recruiter", role: "recruiter", password: "long-enough-password-1", mustChange: false });
    recruiterId = (await users.listAdmins()).find((u) => u.email === "recruiter@example.test")!.id;
  });

  it("assigns applications to the single recruiter on an opening and records assignments", async () => {
    const { data } = openings.parseOpening({ ...opening, title: "SAP ABAP Developer", sap_module: "ABAP", salary_range: "₹20 LPA", salary_visible: "hide", vacancies: "3", min_experience_years: "4" });
    expect(data).toMatchObject({ vacancies: 3, salary_visible: false, min_experience_years: 4 });
    openingId = await openings.createOpening(data, adminId);
    await openings.setOpeningRecruiters(openingId, [recruiterId, "not-a-uuid"]);
    expect(await openings.getOpeningRecruiters(openingId)).toEqual([recruiterId]);

    // Salary stays internal when hidden; the admin view still has it.
    const pub = await openings.listPublicOpenings();
    const abap = pub.find((o) => o.title === "SAP ABAP Developer");
    expect(abap?.salary_range).toBe("");
    expect(abap?.vacancies).toBe(3);
    expect((await openings.getOpening(openingId))?.salary_range).toBe("₹20 LPA");

    const a = await apps.recordApplication({
      candidate: { email: "test.candidate@example.test", fullName: "Test Candidate", phone: "+91 90000 11111" },
      openingId,
      source: "job",
      position: "SAP ABAP Developer",
      experience: "5–8 years",
    });
    const detail = await apps.getApplication(a.id);
    expect(detail?.assigned_to).toBe(recruiterId);

    expect(await apps.assignApplication(a.id, null, adminId)).toBe(true);
    expect(await apps.assignApplication(a.id, null, adminId)).toBe(false);
    expect((await apps.listApplications({ assigned: "none", opening: openingId })).rows).toHaveLength(1);
    const after = await apps.getApplication(a.id);
    expect(after?.events.map((e) => e.kind)).toContain("assign");
  });

  it("moves cards through the pipeline once and reports conversion", async () => {
    const [row] = (await apps.listApplications({ opening: openingId })).rows;
    expect(await apps.setApplicationStatus(row.id, "screening", adminId)).toBe(true);
    // Moving to the stage it is already in changes nothing and writes no history.
    expect(await apps.setApplicationStatus(row.id, "screening", adminId)).toBe(false);
    expect(await apps.setApplicationStatus(row.id, "hired", adminId)).toBe(true);
    const conn = await db();
    const [h] = await conn.query<{ hired_at: string | null }>(`SELECT hired_at FROM applications WHERE id = $1`, [row.id]);
    expect(h.hired_at).toBeTruthy();

    const board = await apps.listPipeline({ opening: openingId });
    expect(board.cards.map((c) => c.status)).toEqual(["hired"]);
    const conv = await apps.pipelineConversion({ opening: openingId });
    expect(conv.total).toBe(1);
    // A hire counts as having passed through every earlier stage.
    expect(conv.stages.find((s) => s.stage === "screening")?.count).toBe(1);
    expect(conv.stages.find((s) => s.stage === "hired")?.ofTotal).toBe(1);
  });

  it("edits a profile with a field-level history and finds duplicates", async () => {
    const c = await candidates();
    const [row] = (await apps.listApplications({ opening: openingId })).rows;
    const bad = c.parseCandidate({ full_name: "X", experience_years: "99", linkedin_url: "http://evil.test" });
    expect(Object.keys(bad.errors).sort()).toEqual(["experience_years", "full_name", "linkedin_url"]);
    const { data, errors } = c.parseCandidate({
      full_name: "Test Candidate",
      phone: "+91 90000 11111",
      experience_years: "6.5",
      skills: "ABAP, RAP, abap, CDS Views",
      tags: "Bench",
      availability: "Within 30 days",
    });
    expect(errors).toEqual({});
    expect(data.skills).toEqual(["ABAP", "RAP", "CDS Views"]);
    const res = await c.updateCandidate(row.candidate_id, data, adminId);
    expect(res?.changed).toEqual(expect.arrayContaining(["Experience (years)", "Skills", "Tags", "Availability"]));

    await c.setCandidateFields(row.candidate_id, { priority: "urgent", owner_id: recruiterId, follow_up_on: "2020-01-01" }, adminId);
    const prof = await c.getCandidate(row.candidate_id);
    expect(prof).toMatchObject({ priority: "urgent", owner_name: "Test Recruiter", experience_years: 6.5 });
    expect(prof?.timeline.filter((e) => e.kind === "edit")).toHaveLength(2);

    expect((await c.listCandidates({ skill: "abap, rap" })).total).toBe(1);
    expect((await c.listCandidates({ skill: "abap, fico" })).total).toBe(0);
    expect((await c.listCandidates({ followUp: "due" })).total).toBe(1);
    expect((await c.listCandidates({ minYears: "7" })).total).toBe(0);

    // A second profile with the same phone number shows up as a duplicate.
    await apps.recordApplication({ candidate: { email: "test.candidate.alt@example.test", fullName: "T. Candidate", phone: "090000 11111" }, source: "careers", position: "ABAP", experience: "" });
    expect(prof && (await c.findDuplicates(prof))).toEqual([expect.objectContaining({ email: "test.candidate.alt@example.test", reason: "Same phone number" })]);
  });

  it("merges a duplicate into the kept profile in one step", async () => {
    const c = await candidates();
    const conn = await db();
    const [keep] = await conn.query<{ id: string }>(`SELECT id FROM candidates WHERE email = 'test.candidate@example.test'`);
    const [drop] = await conn.query<{ id: string }>(`SELECT id FROM candidates WHERE email = 'test.candidate.alt@example.test'`);
    await c.addCandidateNote(drop.id, "Called, interested", adminId);
    expect(await c.mergeCandidates(keep.id, drop.id, adminId)).toBe(true);
    expect(await c.getCandidate(drop.id)).toBeNull();
    const merged = await c.getCandidate(keep.id);
    expect(merged?.applications).toHaveLength(2);
    expect(merged?.timeline.map((e) => e.kind)).toEqual(expect.arrayContaining(["merge", "note"]));
    expect(merged?.duplicates).toHaveLength(0);
    expect(await c.mergeCandidates(keep.id, keep.id, adminId)).toBe(false);
  });
});
