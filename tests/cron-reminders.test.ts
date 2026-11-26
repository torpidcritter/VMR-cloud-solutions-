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
    expect(await res.json()).toEqual({ due: 3, sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "recruiter@example.test" });
    expect(send.mock.calls[0][0].text).toContain("https://site.example.test/admin/interviews/a");
    expect(release).toHaveBeenCalledWith("c");
  });
});
