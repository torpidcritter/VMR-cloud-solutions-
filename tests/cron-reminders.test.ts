import { beforeEach, describe, expect, it, vi } from "vitest";

const due = vi.fn();
const claim = vi.fn();
const release = vi.fn();
const send = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/interviews", () => ({
  interviewsNeedingReminder: (...a: unknown[]) => due(...a),
  claimReminder: (...a: unknown[]) => claim(...a),
  releaseReminder: (...a: unknown[]) => release(...a),
  interviewIcs: () => "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
}));
const claimDue = vi.fn();
const notify = vi.fn();
vi.mock("@/lib/data/tasks", () => ({ claimDueReminders: (...a: unknown[]) => claimDue(...a) }));
vi.mock("@/lib/data/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
const prune = vi.fn();
vi.mock("@/lib/data/audit", () => ({ pruneAudit: (...a: unknown[]) => prune(...a) }));
vi.mock("@/lib/data/settings", () => ({ getSettings: async () => ({ auditRetentionDays: 365 }) }));
const PRUNED = { keepDays: 365, activity: 4, logins: 2, notifications: 1 };
vi.mock("@/lib/mailer", async () => {
  const real = await vi.importActual<typeof import("@/lib/mailer")>("@/lib/mailer");
  return { ...real, isMailConfigured: () => true, sendMail: (...a: unknown[]) => send(...a) };
});

const { GET } = await import("@/app/api/cron/reminders/route");
const SECRET = "a-long-cron-secret-for-tests";
const call = (auth?: string) => GET(new Request("https://site.example.test/api/cron/reminders", { headers: auth ? { authorization: auth } : {} }));
const interview = (id: string) => ({
  id,
  round: "Technical round 1",
  candidate_name: "Test Candidate",
  opening_title: "SAP MM Consultant",
  position: "SAP MM Consultant",
  scheduled_at: "2026-12-01T09:00:00.000Z",
  duration_minutes: 60,
  mode: "video",
  location: "https://meet.example.test/abc",
  panel: [{ id: "u1", name: "Test Recruiter", email: "recruiter@example.test" }],
});

describe("GET /api/cron/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    claimDue.mockResolvedValue({ tasks: [], followUps: [] });
    notify.mockResolvedValue(1);
    prune.mockResolvedValue(PRUNED);
  });

  it("refuses calls without the secret, and stays closed when no secret is set", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect(due).not.toHaveBeenCalled();
  });

  it("emails each claimed panel once and gives back a claim when sending fails", async () => {
    due.mockResolvedValue([interview("a"), interview("b"), interview("c")]);
    claim.mockImplementation(async (id: string) => id !== "b"); // b was claimed by another run
    send.mockImplementation(async (m: { subject: string }) => {
      if (send.mock.calls.length === 2) throw new Error("smtp down");
      return m;
    });
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ due: 3, sent: 1, failed: 1, notified: 0, pruned: PRUNED });
    expect(prune).toHaveBeenCalledWith(365);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "recruiter@example.test" });
    expect(send.mock.calls[0][0].text).toContain("https://site.example.test/admin/interviews/a");
    expect(release).toHaveBeenCalledWith("c");
  });

  it("posts one in-app reminder per person for due tasks and follow-ups", async () => {
    due.mockResolvedValue([]);
    claimDue.mockResolvedValue({ tasks: [{ owner_id: "u1", overdue: 2, due_today: 1 }, { owner_id: "u2", overdue: 0, due_today: 1 }], followUps: [{ owner_id: "u1", count: 3 }] });
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ notified: 3 });
    expect(notify.mock.calls.map((c) => [c[0][0], c[3]])).toEqual([
      ["u1", "You have 2 overdue tasks and 1 task due today"],
      ["u2", "You have 1 task due today"],
      ["u1", "3 candidate follow-ups due"],
    ]);
  });

  it("still sends interview emails when the in-app reminders fail", async () => {
    claimDue.mockRejectedValue(new Error("db busy"));
    prune.mockRejectedValue(new Error("db busy"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    due.mockResolvedValue([interview("a")]);
    claim.mockResolvedValue(true);
    send.mockResolvedValue({});
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({ due: 1, sent: 1, failed: 0, notified: 0, pruned: null });
    err.mockRestore();
  });
});
