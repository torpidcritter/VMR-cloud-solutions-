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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
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
    expect(rows.map((r) => Number(r.version))).toEqual([1, 2, 3, 4, 5]);
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

describe("ATS: interviews and the recruiter workspace", () => {
  const iv = () => import("@/lib/data/interviews");
  const ws = () => import("@/lib/data/workspace");
  let adminId = "";
  let recruiterId = "";
  let appId = "";
  let otherAppId = "";
  let interviewId = "";
  // Tomorrow in IST, so the test never depends on the time of day.
  const tomorrow = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
  const form = (over: Record<string, string> = {}) => ({ round: "Technical round 1", date: tomorrow, time: "11:00", duration: "60", mode: "video", location: "https://meet.example.test/abc", notes: "", ...over });

  beforeAll(async () => {
    const all = await users.listAdmins();
    adminId = all.find((u) => u.role === "super_admin")!.id;
    recruiterId = all.find((u) => u.email === "recruiter@example.test")!.id;
    const a = await apps.recordApplication({
      candidate: { email: "interview.tester@example.test", fullName: "Interview Tester", phone: "+91 90000 22222" },
      source: "careers",
      position: "SAP MM Consultant",
      experience: "3–5 years",
    });
    const b = await apps.recordApplication({
      candidate: { email: "second.interview@example.test", fullName: "Second Interviewee", phone: "+91 90000 33333" },
      source: "careers",
      position: "SAP SD Consultant",
      experience: "3–5 years",
    });
    appId = a.id;
    otherAppId = b.id;
    await apps.assignApplication(appId, recruiterId, adminId);
  });

  it("converts IST and validates the schedule form", async () => {
    const { istToIso, isoToIst, parseInterview } = await iv();
    expect(istToIso("2026-12-01", "14:30")).toBe("2026-12-01T09:00:00.000Z");
    expect(isoToIst("2026-12-01T09:00:00.000Z")).toEqual({ date: "2026-12-01", time: "14:30" });
    expect(istToIso("01/12/2026", "14:30")).toBeNull();

    const ok = parseInterview(form(), [recruiterId, recruiterId, "nope"]);
    expect(ok.errors).toEqual({});
    expect(ok.data.panel).toEqual([recruiterId]);

    const bad = parseInterview(form({ round: "", date: "2020-01-01", duration: "5", mode: "carrier-pigeon", location: "zoom" }), []);
    expect(Object.keys(bad.errors).sort()).toEqual(["date", "duration", "mode", "panel", "round"]);
    expect(parseInterview(form({ location: "not a link" }), [recruiterId]).errors.location).toBeTruthy();
    expect(parseInterview(form({ mode: "in_person", location: "Hyderabad office" }), [recruiterId]).errors).toEqual({});
  });

  it("schedules an interview, moves the application on and records it", async () => {
    const { parseInterview, scheduleInterview, getInterview } = await iv();
    const { data } = parseInterview(form(), [recruiterId]);
    interviewId = (await scheduleInterview(appId, data, adminId))!;
    expect(interviewId).toMatch(/^[0-9a-f-]{36}$/);
    const i = await getInterview(interviewId);
    expect(i).toMatchObject({ status: "scheduled", round: "Technical round 1", duration_minutes: 60, candidate_name: "Interview Tester" });
    expect(i!.panel.map((p) => p.id)).toEqual([recruiterId]);
    const app = await apps.getApplication(appId);
    expect(app?.status).toBe("interview_scheduled");
    expect(app?.events.map((e) => e.kind)).toEqual(expect.arrayContaining(["interview", "status"]));
    // An unknown application schedules nothing.
    expect(await scheduleInterview("00000000-0000-0000-0000-000000000000", data, adminId)).toBeFalsy();
  });

  it("finds overlapping interviews for the same panel and lets a reschedule move past them", async () => {
    const { parseInterview, findConflicts, rescheduleInterview, getInterview } = await iv();
    const clash = parseInterview(form({ time: "11:30", duration: "30" }), [recruiterId]).data;
    const found = await findConflicts(clash, otherAppId);
    expect(found.map((c) => c.id)).toEqual([interviewId]);
    // Back-to-back is not a clash, nor is the interview being edited.
    expect(await findConflicts(parseInterview(form({ time: "12:00" }), [recruiterId]).data, otherAppId)).toEqual([]);
    expect(await findConflicts(clash, appId, interviewId)).toEqual([]);

    const moved = parseInterview(form({ time: "15:00" }), [recruiterId, adminId]).data;
    expect(await rescheduleInterview(interviewId, moved, adminId)).toBe(true);
    const i = await getInterview(interviewId);
    expect(i?.scheduled_at).toBe(moved.scheduledAt);
    expect(i?.panel).toHaveLength(2);
    const app = await apps.getApplication(appId);
    expect(app?.events.some((e) => /moved from/.test(e.body ?? ""))).toBe(true);
  });

  it("collects one feedback entry per interviewer and completes the interview", async () => {
    const { parseFeedback, saveFeedback, getInterview, setInterviewStatus } = await iv();
    expect(Object.keys(parseFeedback({ rating: "9", recommendation: "perhaps" }).errors).sort()).toEqual(["rating", "recommendation"]);
    const fb = parseFeedback({ rating: "4", recommendation: "yes", notes: "Solid on MM pricing." });
    expect(fb.errors).toEqual({});
    expect(await saveFeedback(interviewId, recruiterId, fb.data)).toBe(true);
    expect(await saveFeedback(interviewId, recruiterId, { ...fb.data, rating: 5, recommendation: "strong_yes" })).toBe(true);
    const i = await getInterview(interviewId);
    expect(i?.feedback).toHaveLength(1);
    expect(i?.feedback[0]).toMatchObject({ rating: 5, recommendation: "strong_yes" });
    expect(i?.status).toBe("completed");
    expect((await apps.getApplication(appId))?.status).toBe("interview_completed");
    // A finished interview cannot change status again.
    expect(await setInterviewStatus(interviewId, "cancelled", adminId, "late")).toBe(false);
  });

  it("cancels with a reason, refuses feedback on a cancelled interview and leaves the stage alone", async () => {
    const { parseInterview, scheduleInterview, setInterviewStatus, saveFeedback, getInterview } = await iv();
    const id = (await scheduleInterview(otherAppId, parseInterview(form({ time: "17:00" }), [adminId]).data, adminId))!;
    expect(await setInterviewStatus(id, "cancelled", adminId, "Candidate asked to move it")).toBe(true);
    const i = await getInterview(id);
    expect(i).toMatchObject({ status: "cancelled", cancel_reason: "Candidate asked to move it" });
    expect(await saveFeedback(id, adminId, { rating: 3, recommendation: "maybe", notes: "" })).toBe(false);
    expect((await apps.getApplication(otherAppId))?.status).toBe("interview_scheduled");
  });

  it("lists interviews by person and range, and claims each reminder only once", async () => {
    const { parseInterview, scheduleInterview, listInterviews, interviewsNeedingReminder, claimReminder, releaseReminder } = await iv();
    const soon = new Date(Date.now() + 2 * 3600_000 + 5.5 * 3600_000).toISOString();
    const id = (await scheduleInterview(otherAppId, parseInterview(form({ date: soon.slice(0, 10), time: soon.slice(11, 16), round: "HR round" }), [recruiterId]).data, adminId))!;

    const mine = await listInterviews({ userId: recruiterId });
    expect(mine.map((r) => r.id)).toContain(id);
    expect((await listInterviews({ userId: adminId, status: "scheduled" })).map((r) => r.id)).not.toContain(id);

    expect((await interviewsNeedingReminder(24)).map((r) => r.id)).toEqual([id]);
    const claims = await Promise.all([claimReminder(id), claimReminder(id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await interviewsNeedingReminder(24)).toEqual([]);
    await releaseReminder(id);
    expect((await interviewsNeedingReminder(24)).map((r) => r.id)).toEqual([id]);
  });

  it("builds a calendar file without the client's name", async () => {
    const { getInterview, interviewIcs } = await iv();
    const ics = interviewIcs((await getInterview(interviewId))!, "https://admin.example.test");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain(`UID:interview-${interviewId}@vmrcloudsolutions.com`);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).not.toContain("Confidential Client");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  it("sets monthly targets and gathers a recruiter's day", async () => {
    const { getTarget, setTarget, myWork } = await ws();
    expect(await getTarget(recruiterId)).toBeNull();
    await setTarget(recruiterId, 4);
    await setTarget(recruiterId, 6);
    expect(await getTarget(recruiterId)).toBe(6);

    const conn = await db();
    await conn.query(`UPDATE applications SET stage_changed_at = now() - interval '10 days' WHERE id = $1`, [appId]);
    const w = await myWork(recruiterId);
    expect(w.target).toBe(6);
    expect(w.open).toBeGreaterThanOrEqual(1);
    expect(w.byStage.interview_completed).toBe(1);
    expect(w.stale.map((s) => s.id)).toContain(appId);
    expect(w.interviews.every((i) => i.status === "scheduled")).toBe(true);
    expect(w.interviews.length).toBeGreaterThanOrEqual(1);

    await setTarget(recruiterId, null);
    expect(await getTarget(recruiterId)).toBeNull();
  });
});

describe("ATS: Talent Bank, pools and matching", () => {
  const talent = () => import("@/lib/data/talent");
  const matching = () => import("@/lib/data/matching");
  const candidates = () => import("@/lib/data/candidates");
  let adminId = "";
  let sourcedId = "";
  let applicantId = "";
  let fiOpeningId = "";
  let poolId = "";

  beforeAll(async () => {
    adminId = (await users.listAdmins()).find((u) => u.role === "super_admin")!.id;
    const { data } = openings.parseOpening({ ...opening, title: "S/4HANA FICO Lead", sap_module: "FICO", skills: "SAP FI, SAP CO, S/4HANA, Asset Accounting", location: "Bengaluru", min_experience_years: "5" });
    fiOpeningId = await openings.createOpening(data, adminId);
  });

  it("adds a sourced candidate once, with a stored resume and its text", async () => {
    const { parseNewCandidate, createCandidate, addCandidateFile, listCandidateFiles } = await talent();
    const bad = parseNewCandidate({ fullName: "X", email: "nope", phone: "abc", experienceYears: "99" });
    expect(Object.keys(bad.errors).sort()).toEqual(["email", "experienceYears", "fullName", "phone"]);
    const { data, errors } = parseNewCandidate({ fullName: "Sourced Tester", email: "Sourced.Tester@Example.test", location: "Bengaluru", skills: "SAP FICO, S/4HANA, SAP FICO", experienceYears: "7" });
    expect(errors).toEqual({});
    expect(data.skills).toEqual(["SAP FICO", "S/4HANA"]);
    sourcedId = (await createCandidate(data, adminId))!;
    expect(sourcedId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await createCandidate(data, adminId)).toBeNull();

    const fileId = await addCandidateFile(
      sourcedId,
      { path: "candidates/2026/11/00000000-0000-4000-8000-000000000001/resume.pdf", name: "cv.pdf", size: 1200, type: "pdf", text: "Ten years of asset accounting and cutover on S/4 HANA.", status: "ok" },
      adminId,
    );
    expect(fileId).toBeTruthy();
    expect(await addCandidateFile("00000000-0000-0000-0000-000000000000", { path: "candidates/x", name: "x.pdf", size: 1, type: "pdf", text: "", status: "empty" }, adminId)).toBeNull();
    const files = await listCandidateFiles(sourcedId);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ file_name: "cv.pdf", text_status: "ok" });
    const c = await (await candidates()).getCandidate(sourcedId);
    expect(c?.timeline.map((e) => e.kind)).toEqual(expect.arrayContaining(["file", "edit"]));
  });

  it("searches resume text from uploads and from website applications", async () => {
    const a = await apps.recordApplication({
      candidate: { email: "applicant.tester@example.test", fullName: "Applicant Tester", phone: "+91 90000 44444" },
      source: "careers",
      position: "SAP CO Consultant",
      experience: "3–5 years",
      resume: { path: "applications/2026/11/00000000-0000-4000-8000-000000000002/resume.pdf", name: "cv.pdf", size: 900, type: "application/pdf" },
      resumeText: { status: "ok", text: "Product costing, SAP CO and S4HANA reporting in Pune." },
    });
    applicantId = (await apps.getApplication(a.id))!.candidate_id;
    const { listCandidates } = await candidates();
    const names = async (resume: string) => (await listCandidates({ resume })).rows.map((r) => r.full_name).sort();
    expect(await names("S/4HANA")).toEqual(["Applicant Tester", "Sourced Tester"]);
    expect(await names('"asset accounting" cutover')).toEqual(["Sourced Tester"]);
    expect(await names("costing")).toEqual(["Applicant Tester"]);
    expect(await names("payroll")).toEqual([]);
    // Resumes on file show in the list for both.
    expect((await listCandidates({ resume: "S4HANA" })).rows.every((r) => r.has_resume)).toBe(true);
    expect((await listCandidates({ contacted: "never", resume: "costing" })).total).toBe(1);
  });

  it("keeps pools unique by name, adds members once and logs each change", async () => {
    const { savePool, addToPool, removeFromPool, poolsForCandidate, getPool, deletePool } = await talent();
    poolId = (await savePool(null, { name: "FICO Bengaluru", description: "" }, adminId)) as string;
    expect(await savePool(null, { name: "fico bengaluru", description: "" }, adminId)).toBe("duplicate");
    expect(await addToPool(poolId, [sourcedId, applicantId, sourcedId, "not-a-uuid"], adminId)).toBe(2);
    expect(await addToPool(poolId, [sourcedId], adminId)).toBe(0);
    expect((await getPool(poolId))?.members).toBe(2);
    expect((await (await candidates()).listCandidates({ pool: poolId })).total).toBe(2);
    expect(await removeFromPool(poolId, applicantId, adminId)).toBe(true);
    expect(await removeFromPool(poolId, applicantId, adminId)).toBe(false);
    expect((await poolsForCandidate(sourcedId)).map((p) => p.name)).toEqual(["FICO Bengaluru"]);
    const timeline = (await (await candidates()).getCandidate(applicantId))!.timeline.filter((e) => e.kind === "pool").map((e) => e.body);
    expect(timeline).toEqual(["Removed from the talent pool FICO Bengaluru", "Added to the talent pool FICO Bengaluru"]);
    const temp = (await savePool(null, { name: "Temporary", description: "" }, adminId)) as string;
    await addToPool(temp, [sourcedId], adminId);
    expect(await deletePool(temp)).toBe("Temporary");
    expect((await poolsForCandidate(sourcedId)).map((p) => p.name)).toEqual(["FICO Bengaluru"]);
  });

  it("ranks Talent Bank candidates for an opening with reasons, and puts one forward once", async () => {
    const { matchCandidatesForOpening, matchOpeningsForCandidate, addCandidateToOpening } = await matching();
    const r = (await matchCandidatesForOpening(fiOpeningId))!;
    expect(r.terms).toEqual(["SAP FI", "SAP CO", "S/4HANA", "Asset Accounting", "FICO"]);
    const [best] = r.matches;
    const next = r.matches.find((m) => m.full_name === "Applicant Tester")!;
    expect(best.full_name).toBe("Sourced Tester");
    expect(best.match.reasons.filter((x) => x.ok).map((x) => x.text)).toEqual(
      expect.arrayContaining(["Has SAP FI, SAP CO, S/4HANA (3 of 4 skills)", "Resume mentions Asset Accounting", "7 yrs experience (needs 5+)", "Bengaluru works for them"]),
    );
    expect(next.match.score).toBeLessThan(best.match.score);
    expect(next.match.reasons).toContainEqual({ ok: true, text: "Resume mentions SAP CO, S/4HANA" });

    const first = await addCandidateToOpening(sourcedId, fiOpeningId, adminId);
    expect(first?.created).toBe(true);
    const again = await addCandidateToOpening(sourcedId, fiOpeningId, adminId);
    expect(again).toEqual({ id: first!.id, created: false });
    const app = await apps.getApplication(first!.id);
    expect(app).toMatchObject({ source: "talent", status: "new", assigned_to: adminId, position: "S/4HANA FICO Lead" });

    // Once in the pipeline they are no longer suggested, and the opening shows as applied on their profile.
    const after = (await matchCandidatesForOpening(fiOpeningId))!;
    expect(after.applied).toBe(1);
    expect(after.matches.map((m) => m.full_name)).not.toContain("Sourced Tester");
    const forThem = await matchOpeningsForCandidate(sourcedId);
    expect(forThem.find((o) => o.id === fiOpeningId)?.applied).toBe(true);
  });

  it("carries resumes and pools through a merge, and keeps a profile with uploads when its last application goes", async () => {
    const { listCandidateFiles, poolsForCandidate, addToPool } = await talent();
    const { mergeCandidates, getCandidate } = await candidates();
    await addToPool(poolId, [applicantId], adminId);
    expect(await mergeCandidates(applicantId, sourcedId, adminId)).toBe(true);
    expect(await listCandidateFiles(applicantId)).toHaveLength(1);
    expect((await poolsForCandidate(applicantId)).map((p) => p.name)).toEqual(["FICO Bengaluru"]);
    const merged = await getCandidate(applicantId);
    for (const a of merged!.applications) await apps.deleteApplication(a.id);
    expect(await getCandidate(applicantId)).not.toBeNull();
  });
});

describe("ATS: client CRM, candidate email and notifications", () => {
  const clients = () => import("@/lib/data/clients");
  const email = () => import("@/lib/data/email");
  const notes = () => import("@/lib/data/notifications");
  const tpl = () => import("@/lib/email-templates");
  let adminId = "";
  let salesId = "";
  let clientId = "";

  beforeAll(async () => {
    adminId = (await users.listAdmins()).find((u) => u.role === "super_admin")!.id;
    salesId = await users.createAdmin({ email: "sales.tester@example.test", name: "Sales Tester", role: "sales", password: "sales-pass-42", mustChange: false });
  });

  it("gives each role the right client and email rights", async () => {
    const { can } = await import("@/lib/auth/permissions");
    expect([can("sales", "clients.view"), can("sales", "clients.edit"), can("sales", "email.send"), can("sales", "clients.delete")]).toEqual([true, true, false, false]);
    expect([can("recruiter", "clients.edit"), can("recruiter", "email.send"), can("recruiter", "clients.delete")]).toEqual([true, true, false]);
    expect([can("viewer", "clients.view"), can("viewer", "email.send")]).toEqual([false, false]);
    expect(can("super_admin", "clients.delete")).toBe(true);
  });

  it("links every opening to a client record by name, atomically, and keeps the name out of the public site", async () => {
    const { listClients, clientOfOpening, clientOpenings, listClientEvents } = await clients();
    const a = await openings.createOpening(openings.parseOpening({ ...opening, title: "ABAP Developer", client_name: "Acme Test Co" }).data, adminId);
    const b = await openings.createOpening(openings.parseOpening({ ...opening, title: "Basis Lead", client_name: "acme test co" }).data, adminId);
    const ca = await clientOfOpening(a);
    expect(ca?.name).toBe("Acme Test Co");
    expect((await clientOfOpening(b))?.id).toBe(ca!.id);
    clientId = ca!.id;
    expect((await clientOpenings(clientId)).map((o) => o.title).sort()).toEqual(["ABAP Developer", "Basis Lead"]);
    expect((await listClientEvents(clientId)).map((e) => e.body)).toEqual(expect.arrayContaining(["Opening added: ABAP Developer", "Opening added: Basis Lead"]));
    // Openings made earlier in this file were linked as they were created.
    expect((await listClients({ q: "Confidential Client" }))[0]).toMatchObject({ name: "Confidential Client Ltd" });

    // Clearing the client name unlinks; a new name links (and records it).
    await openings.updateOpening(b, openings.parseOpening({ ...opening, title: "Basis Lead", client_name: "" }).data, adminId);
    expect(await clientOfOpening(b)).toBeNull();
    await openings.updateOpening(b, openings.parseOpening({ ...opening, title: "Basis Lead", client_name: "Acme Test Co" }).data, adminId);
    expect((await clientOfOpening(b))?.id).toBe(clientId);
    expect((await listClientEvents(clientId)).map((e) => e.body)).toContain("Opening linked: Basis Lead");

    const pub = await openings.listPublicOpenings();
    const json = JSON.stringify(pub);
    expect(json).not.toContain("Acme Test Co");
    expect(json).not.toContain("client_id");
    expect(pub.every((o) => !("client_name" in o))).toBe(true);
  });

  it("renames a client everywhere at once, refuses duplicate names and won't delete a client with openings", async () => {
    const { saveClient, parseClient, getClient, deleteClient, clientOpenings } = await clients();
    const bad = parseClient({ name: "", website: "not a site" });
    expect(Object.keys(bad.errors).sort()).toEqual(["name", "website"]);
    const other = await saveClient(null, parseClient({ name: "Beta Test Ltd" }).data, adminId);
    expect(other).toMatchObject({ changed: [] });
    expect(await saveClient(null, parseClient({ name: "beta test ltd" }).data, adminId)).toBe("duplicate");
    const res = await saveClient(clientId, parseClient({ name: "Acme Test Group", status: "active", account_manager_id: salesId, website: "acme.example.test" }).data, adminId);
    expect(res).toMatchObject({ id: clientId, changed: ["Name", "Website", "Account manager"] });
    expect((await getClient(clientId))?.account_manager_name).toBe("Sales Tester");
    const ids = (await clientOpenings(clientId)).map((o) => o.id);
    for (const id of ids) expect((await openings.getOpening(id))?.client_name).toBe("Acme Test Group");
    expect(await deleteClient(clientId)).toBe("has_openings");
    expect(await deleteClient((other as { id: string }).id)).toEqual({ name: "Beta Test Ltd" });
  });

  it("keeps one primary contact and logs requirements, linking one to its opening only for the same client", async () => {
    const { addContact, parseContact, listContacts, setPrimaryContact, deleteContact, addRequirement, parseRequirement, listRequirements, setRequirementStatus, linkRequirementToOpening, listClientEvents, clientOpenings } = await clients();
    expect(Object.keys(parseContact({ name: "A", email: "x", phone: "zz" }).errors).sort()).toEqual(["email", "name", "phone"]);
    await addContact(clientId, parseContact({ name: "First Contact", email: "First@Example.test" }).data, adminId);
    const second = await addContact(clientId, parseContact({ name: "Second Contact", title: "HR Manager" }).data, adminId);
    let list = await listContacts(clientId);
    expect(list.map((k) => [k.name, k.is_primary, k.email])).toEqual([["First Contact", true, "first@example.test"], ["Second Contact", false, ""]]);
    await setPrimaryContact(second!, adminId);
    list = await listContacts(clientId);
    expect(list.filter((k) => k.is_primary).map((k) => k.name)).toEqual(["Second Contact"]);
    await deleteContact(list[1].id, adminId);
    expect((await listContacts(clientId)).map((k) => k.name)).toEqual(["Second Contact"]);

    expect(Object.keys(parseRequirement({ title: "", positions: "0" }).errors).sort()).toEqual(["positions", "title"]);
    const reqId = await addRequirement(clientId, parseRequirement({ title: "SAP MM Consultant", sap_module: "MM", positions: "3", needed_by: "2027-01-31" }).data, adminId);
    expect(await addRequirement("00000000-0000-4000-8000-000000000000", parseRequirement({ title: "Ghost" }).data, adminId)).toBeNull();
    expect(await setRequirementStatus(reqId!, "on_hold", adminId)).toBe(clientId);
    expect(await setRequirementStatus(reqId!, "on_hold", adminId)).toBeNull();
    expect(await setRequirementStatus(reqId!, "bogus", adminId)).toBeNull();

    const foreign = await openings.createOpening(openings.parseOpening({ ...opening, title: "Other client job", client_name: "Someone Else Test" }).data, adminId);
    expect(await linkRequirementToOpening(reqId!, foreign, adminId)).toBe(false);
    const own = (await clientOpenings(clientId))[0].id;
    expect(await linkRequirementToOpening(reqId!, own, adminId)).toBe(true);
    const [req] = await listRequirements(clientId);
    expect(req).toMatchObject({ positions: 3, status: "on_hold", needed_by: "2027-01-31", opening_id: own });
    const bodies = (await listClientEvents(clientId)).map((e) => e.body);
    expect(bodies).toEqual(expect.arrayContaining(["New requirement: 3 × SAP MM Consultant", "Requirement marked on hold: SAP MM Consultant", "Second Contact is now the primary contact"]));
  });

  it("turns a website enquiry into a prospect, or adds it to the client that already exists", async () => {
    const { createClientFromEnquiry, clientForEnquiry, getClient, listContacts } = await clients();
    const e1 = await enquiries.recordEnquiry({ name: "Enquiry Person", company: "Gamma Test Pvt", email: "enquiry.person@example.test", phone: "+91 90000 00000", service: "SAP staffing", requirement: "2 ABAP", message: "Need help." });
    const made = await createClientFromEnquiry(e1.id, salesId);
    expect(made?.existed).toBe(false);
    expect(await getClient(made!.id)).toMatchObject({ name: "Gamma Test Pvt", status: "prospect", enquiry_id: e1.id });
    expect((await listContacts(made!.id)).map((k) => [k.name, k.email, k.is_primary])).toEqual([["Enquiry Person", "enquiry.person@example.test", true]]);
    expect((await clientForEnquiry(e1.id))?.id).toBe(made!.id);
    const e2 = await enquiries.recordEnquiry({ name: "Another Person", company: "gamma test pvt", email: "another@example.test", phone: "", service: "", requirement: "", message: "Follow-up." });
    const again = await createClientFromEnquiry(e2.id, salesId);
    expect(again).toEqual({ id: made!.id, existed: true });
    expect((await listContacts(made!.id)).map((k) => k.name)).toEqual(["Enquiry Person", "Another Person"]);
  });

  it("fills merge fields, never from the client, and builds safe mail", async () => {
    const { renderTemplate, unfilledFields, cleanSubject, bodyToHtml } = await tpl();
    expect(renderTemplate("Hi {{candidate_first_name}}, re {{ position }} on {{interview_date}}", { candidate_first_name: "Asha", position: "ABAP Developer" })).toBe(
      "Hi Asha, re ABAP Developer on {{interview_date}}",
    );
    expect(unfilledFields("{{interview_date}} {{interview_date}} {{x_y}}")).toEqual(["interview_date", "x_y"]);
    expect(cleanSubject("Hello\r\nBcc: someone@example.test")).toBe("Hello Bcc: someone@example.test");
    expect(bodyToHtml('<script>alert(1)</script>\nline 2\n\npara "2"')).toContain("&lt;script&gt;alert(1)&lt;/script&gt;<br>line 2</p>");

    const { composeContext } = await email();
    const [job] = await (await clients()).clientOpenings(clientId);
    const app = await apps.recordApplication({
      candidate: { email: "mail.tester@example.test", fullName: "Mail Tester", phone: "" },
      openingId: job.id,
      source: "job",
      position: "ABAP Developer",
      experience: "3–5 years",
    });
    const { parseInterview, scheduleInterview } = await import("@/lib/data/interviews");
    const day = new Date(Date.now() + 5.5 * 3600_000 + 3 * 86_400_000).toISOString().slice(0, 10);
    const iv = parseInterview({ round: "Client round", date: day, time: "15:30", duration: "45", mode: "phone", location: "" }, [adminId]);
    expect(iv.errors).toEqual({});
    await scheduleInterview(app.id, iv.data, adminId);
    const ctx = (await composeContext(app.candidateId, "Owner"))!;
    expect(ctx.to).toBe("mail.tester@example.test");
    expect(ctx.applications[0].values).toMatchObject({
      candidate_first_name: "Mail",
      // The opening's title, never the client's name.
      position: job.title,
      recruiter_name: "Owner",
      interview_round: "Client round",
      interview_time: "3:30 pm",
      interview_mode: "Phone",
    });
    expect(ctx.applications[0].values.interview_date).toMatch(/\d{4}$/);
    expect(JSON.stringify(ctx)).not.toMatch(/Acme Test/);
  });

  it("sends an email only to the candidate's own address and records it on the profile", async () => {
    process.env.MAIL_TRANSPORT = "log";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await session.signIn("owner@example.com", "correct-horse-42")).ok).toBe(true);
    const { sendCandidateEmailAction } = await import("@/app/admin/actions/email");
    const { getCandidate, listCandidates } = await import("@/lib/data/candidates");
    const { listEmails, listTemplates, recordEmail } = await email();
    const cand = (await listCandidates({ q: "mail.tester@example.test" })).rows[0];
    const profile = (await getCandidate(cand.id))!;
    const [template] = await listTemplates({ activeOnly: true });
    const fd = (o: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(o)) f.append(k, v);
      return f;
    };
    const missing = await sendCandidateEmailAction({}, fd({ candidateId: cand.id, subject: "Hi", body: "Your interview is on {{interview_date}}" }));
    expect(missing.errors?.body).toMatch(/interview_date/);
    const wrongApp = await sendCandidateEmailAction({}, fd({ candidateId: cand.id, applicationId: "00000000-0000-4000-8000-000000000000", subject: "Hi", body: "Hello" }));
    expect(wrongApp.error).toMatch(/isn't on this profile/);

    const ok = await sendCandidateEmailAction(
      {},
      fd({ candidateId: cand.id, applicationId: profile.applications[0].id, templateId: template.id, to: "attacker@example.test", subject: "Next steps\nBcc: x@example.test", body: "Dear Mail,\n\nThanks." }),
    );
    expect(ok).toMatchObject({ ok: true, message: "Email sent to mail.tester@example.test." });
    const logged = info.mock.calls.find((c) => c[0] === "[mail:log]")?.[1] as { to: string; subject: string; replyTo: string };
    expect(logged).toMatchObject({ to: "mail.tester@example.test", subject: "Next steps Bcc: x@example.test", replyTo: "owner@example.com" });
    info.mockRestore();

    await recordEmail({ candidateId: cand.id, applicationId: null, templateId: null, to: cand.email, subject: "Bounced", body: "x", status: "failed", error: "smtp down", userId: adminId });
    const sent = await listEmails(cand.id);
    expect(sent.map((m) => [m.subject, m.status, m.template_name])).toEqual([["Bounced", "failed", null], ["Next steps Bcc: x@example.test", "sent", template.name]]);
    const after = (await getCandidate(cand.id))!;
    expect(after.timeline.filter((e) => e.kind === "email").map((e) => e.body)).toEqual(["Emailed: Next steps Bcc: x@example.test"]);
    expect(after.last_contacted_at).toBeTruthy();
    delete process.env.MAIL_TRANSPORT;
  });

  it("notifies the right people with safe links, and lets only the owner open a notification", async () => {
    const { notify, listNotifications, unreadCount, openNotification, markAllRead, safeAdminLink } = await notes();
    expect(safeAdminLink("https://evil.example.test/admin")).toBe("/admin");
    expect(safeAdminLink("//evil.example.test")).toBe("/admin");
    expect(safeAdminLink("/admin/clients/abc?x=1")).toBe("/admin/clients/abc?x=1");
    expect(await notify([salesId, adminId, salesId, "junk"], adminId, "client", "You are now the account manager for X", "javascript:alert(1)")).toBe(1);
    const [n] = await listNotifications(salesId);
    expect(n).toMatchObject({ title: "You are now the account manager for X", link: "/admin", read_at: null });
    expect(await unreadCount(salesId)).toBeGreaterThanOrEqual(1);
    expect(await openNotification(n.id, adminId)).toBeNull();
    expect(await openNotification(n.id, salesId)).toBe("/admin");
    await markAllRead(salesId);
    expect(await unreadCount(salesId)).toBe(0);
  });
});
