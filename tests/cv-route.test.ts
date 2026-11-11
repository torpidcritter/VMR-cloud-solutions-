import { beforeEach, describe, expect, it, vi } from "vitest";
import { docx, pdf } from "./helpers/files";

const storeCv = vi.fn();
const sendMail = vi.fn();
let storageReady = true;
let mailReady = true;

vi.mock("@/lib/cv-storage", () => ({
  isStorageConfigured: () => storageReady,
  storeCv: (...args: unknown[]) => storeCv(...args),
}));
vi.mock("@/lib/mailer", async (orig) => ({
  ...(await orig<typeof import("@/lib/mailer")>()),
  isMailConfigured: () => mailReady,
  sendMail: (...args: unknown[]) => sendMail(...args),
}));

const { POST, GET } = await import("@/app/api/cv/route");

let ip = 0;
function request(fields: Record<string, string>, file?: { bytes: Buffer; name: string; type: string } | null, headers: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file) fd.set("cv", new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return new Request("https://vmrcloudsolutions.com/api/cv", {
    method: "POST",
    body: fd,
    headers: { origin: "https://vmrcloudsolutions.com", host: "vmrcloudsolutions.com", "x-forwarded-for": `10.0.0.${++ip}`, ...headers },
  });
}

const fields = {
  fullName: "Priya Sharma",
  email: "priya@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  specialisation: "SAP S/4HANA",
  experience: "8–12 years",
  employmentType: "Both",
  consent: "yes",
  startedAt: String(Date.now() - 60_000),
  website: "",
};
const goodPdf = { bytes: pdf(), name: "Priya CV.pdf", type: "application/pdf" };

beforeEach(() => {
  storageReady = true;
  mailReady = true;
  storeCv.mockReset().mockResolvedValue({ id: "3f2a9c1e-0000-4000-8000-000000000000", driver: "vercel-blob", cvPath: "cv-submissions/2026/11/x/cv.pdf", recordPath: "x" });
  sendMail.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/cv", () => {
  it("stores a valid CV privately, notifies the team and returns a reference", async () => {
    const res = await POST(request(fields, goodPdf));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reference: "3F2A9C1E" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(storeCv).toHaveBeenCalledOnce();
    const stored = storeCv.mock.calls[0][0];
    expect(stored.ext).toBe("pdf");
    expect(stored.record.candidate.email).toBe("priya@example.com");
    expect(stored.record.consent.given).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.attachments[0].filename).toBe("Priya-Sharma-CV.pdf");
    expect(mail.replyTo).toBe("priya@example.com");
  });

  it("accepts DOCX files", async () => {
    const res = await POST(request(fields, { bytes: docx(), name: "cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    expect(res.status).toBe(200);
  });

  it("refuses requests from other sites", async () => {
    const res = await POST(request(fields, goodPdf, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(storeCv).not.toHaveBeenCalled();
  });

  it("does not pretend to succeed when storage or email is not configured", async () => {
    storageReady = false;
    let res = await POST(request(fields, goodPdf));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
    storageReady = true;
    mailReady = false;
    res = await POST(request(fields, goodPdf));
    expect(res.status).toBe(503);
    expect(storeCv).not.toHaveBeenCalled();
  });

  it("returns 503 when the storage write fails", async () => {
    storeCv.mockRejectedValue(new Error("blob down"));
    const res = await POST(request(fields, goodPdf));
    expect(res.status).toBe(503);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("validates fields and consent on the server", async () => {
    const res = await POST(request({ ...fields, consent: "", email: "nope" }, goodPdf));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors.consent).toBeDefined();
    expect(body.errors.email).toBeDefined();
  });

  it("rejects disguised and active-content files", async () => {
    let res = await POST(request(fields, { bytes: Buffer.from("MZ".padEnd(400, "\0")), name: "cv.pdf", type: "application/pdf" }));
    expect(res.status).toBe(422);
    res = await POST(request(fields, { bytes: pdf("/OpenAction << /S /JavaScript >>"), name: "cv.pdf", type: "application/pdf" }));
    expect(res.status).toBe(422);
    res = await POST(request(fields, { bytes: pdf(), name: "cv.exe", type: "application/octet-stream" }));
    expect(res.status).toBe(422);
    expect(storeCv).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before reading them", async () => {
    const res = await POST(request(fields, goodPdf, { "content-length": String(10 * 1024 * 1024) }));
    expect(res.status).toBe(413);
  });

  it("quietly drops bot submissions without storing anything", async () => {
    const res = await POST(request({ ...fields, website: "spam.example" }, goodPdf));
    expect(res.status).toBe(200);
    expect(storeCv).not.toHaveBeenCalled();
  });

  it("still succeeds if the CV is stored but the email fails", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    const res = await POST(request(fields, goodPdf));
    expect(res.status).toBe(200);
  });

  it("does not allow GET", async () => {
    expect(GET().status).toBe(405);
  });
});
