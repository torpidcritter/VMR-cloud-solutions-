import { NextResponse } from "next/server";
import { CONSENT_VERSION, CV_MAX_BYTES, CV_MIME, fileExtension, validateCv } from "@/lib/cv";
import { deleteStoredFile, deleteSubmissionRecord, isStorageConfigured, storeCv } from "@/lib/cv-storage";
import { inspectCvFile } from "@/lib/file-check";
import { clientIp, looksLikeBot, rateLimited, sameOrigin } from "@/lib/guard";
import { isMailConfigured, sendMail, tableHtml } from "@/lib/mailer";
import { isDbConfigured } from "@/lib/db/client";
import { recordApplication } from "@/lib/data/applications";
import { getSettings } from "@/lib/data/settings";
import { saveSubmission } from "@/lib/submissions";
import { extractResumeText } from "@/lib/resume-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

const UNAVAILABLE = "CV uploads are temporarily unavailable.";

export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return json({ ok: false, error: "This request isn't allowed." }, 403);

  // Reject oversized bodies before reading them (form overhead allowance: 64 KB).
  const length = Number(req.headers.get("content-length") || 0);
  if (length > CV_MAX_BYTES + 64 * 1024) {
    return json({ ok: false, errors: { cv: "Your CV must be 4 MB or smaller." } }, 413);
  }

  // The CV must be stored, and someone must find out about it: by email,
  // or in the admin panel when the database is connected.
  if (!isStorageConfigured() || (!isMailConfigured() && !isDbConfigured())) {
    console.error("[cv] upload unavailable: storage or email is not configured");
    return json({ ok: false, error: UNAVAILABLE }, 503);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }
  const fields = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));

  // Bots get a quiet "success" so they don't retry; nothing is stored.
  if (looksLikeBot(fields.website, fields.startedAt)) return json({ ok: true });
  if (await rateLimited(clientIp(req.headers))) {
    return json({ ok: false, error: "Too many submissions. Please try again in a few minutes." }, 429);
  }

  const upload = form.get("cv");
  const file = upload instanceof File ? upload : null;
  const { data, errors } = validateCv(fields, file);
  if (Object.keys(errors).length) return json({ ok: false, errors }, 422);

  const ext = fileExtension(file!.name)!;
  const buffer = Buffer.from(await file!.arrayBuffer());
  const check = inspectCvFile(buffer, ext);
  if (!check.ok) return json({ ok: false, errors: { cv: check.reason } }, 422);

  const submittedAt = new Date().toISOString();
  let stored;
  try {
    stored = await storeCv({
      file: buffer,
      ext,
      contentType: CV_MIME[ext],
      record: {
        candidate: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          location: data.location,
          preferredLocation: data.preferredLocation,
          specialisation: data.specialisation,
          experience: data.experience,
          employmentType: data.employmentType,
        },
        originalFileName: file!.name.slice(0, 180),
        fileSize: buffer.length,
        consent: { given: true, version: CONSENT_VERSION, at: submittedAt },
      },
    });
  } catch (err) {
    console.error("[cv] storage failed", err instanceof Error ? err.message : err);
    return json({ ok: false, error: "We couldn't save your CV just now." }, 503);
  }

  const saved = await saveSubmission("cv", () =>
    recordApplication({
      candidate: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        location: data.location,
        preferredLocation: data.preferredLocation,
        specialisation: data.specialisation,
        experience: data.experience,
        employmentType: data.employmentType,
      },
      source: "cv_upload",
      position: data.specialisation,
      experience: data.experience,
      details: { employmentType: data.employmentType, preferredLocation: data.preferredLocation, consentVersion: CONSENT_VERSION, consentAt: submittedAt, reference: stored.id },
      resume: { path: stored.cvPath, name: file!.name.slice(0, 180), size: buffer.length, type: CV_MIME[ext] },
      resumeText: extractResumeText(buffer, ext),
      submissionKey: typeof fields.submissionId === "string" ? fields.submissionId : null,
    }),
  );
  // The same submission arrived twice (a retry or double click). The first one
  // is saved and was already emailed, so drop this copy and answer with the
  // first reference.
  if (saved?.duplicate) {
    await deleteStoredFile(stored.cvPath).catch(() => undefined);
    await deleteSubmissionRecord(stored.cvPath).catch(() => undefined);
    const first = saved.reference && /^[0-9a-f-]{36}$/i.test(saved.reference) ? saved.reference : stored.id;
    return json({ ok: true, reference: first.slice(0, 8).toUpperCase() });
  }
  const settings = await getSettings();
  if (!isMailConfigured() || !settings.notifyApplications) {
    if (!saved) console.error(`[cv] stored ${stored.id} but neither the database nor email recorded it`);
    return json({ ok: true, reference: stored.id.slice(0, 8).toUpperCase() });
  }

  // The CV is safely stored; the email tells the recruitment team about it.
  const rows: [string, string][] = [
    ["Full name (as per PAN)", data.fullName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Current location", data.location],
    ["Preferred location", data.preferredLocation],
    ["SAP specialisation", data.specialisation],
    ["Total experience", data.experience],
    ["Employment type", data.employmentType],
    ["Consent", `Given ${submittedAt} (policy version ${CONSENT_VERSION})`],
    ["Reference", stored.id],
    ["Stored at", `${stored.driver === "vercel-blob" ? "Vercel Blob (private)" : "Server storage"}: ${stored.cvPath}`],
  ];
  if (saved) rows.push(["Admin reference", `#${saved.number}${saved.repeat ? " (has applied before)" : ""}`]);
  const safeName = `${data.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate"}-CV.${ext}`;
  try {
    await sendMail({
      to: settings.applicationsEmail,
      replyTo: data.email,
      subject: `New SAP CV: ${data.specialisation} (${data.employmentType}) – ${data.fullName}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: tableHtml("New CV submitted on the website", rows),
      attachments: [{ filename: safeName, content: buffer, contentType: CV_MIME[ext] }],
    });
  } catch (err) {
    // Not fatal: the submission is stored and can be found by its reference.
    console.error(`[cv] stored ${stored.id} but notification email failed`, err instanceof Error ? err.message : err);
  }

  return json({ ok: true, reference: stored.id.slice(0, 8).toUpperCase() });
}

export function GET() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
