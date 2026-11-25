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
    const rows = await conn.query<{ version: number }>(`SELECT version FROM schema_migrations`);
    expect(rows.map((r) => Number(r.version))).toEqual([1]);
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
