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
    expect(rows.map((r) => Number(r.version))).toEqual([1, 2, 3, 4]);
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
