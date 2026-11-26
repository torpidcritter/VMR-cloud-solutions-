import { NextResponse } from "next/server";
import { RESUME_TYPES, validateApplication } from "@/lib/forms";
import { CONSENT_VERSION, fileExtension, type CvExtension } from "@/lib/cv";
import { inspectCvFile } from "@/lib/file-check";
import { clientIp, looksLikeBot, rateLimited } from "@/lib/guard";
import { isMailConfigured, sendMail, tableHtml } from "@/lib/mailer";
import { deleteStoredFile, isStorageConfigured, storeResume } from "@/lib/cv-storage";
import { isDbConfigured } from "@/lib/db/client";
import { getLiveOpeningById } from "@/lib/data/openings";
import { OpeningClosedError, recordApplication } from "@/lib/data/applications";
import { getSettings } from "@/lib/data/settings";
import { saveSubmission } from "@/lib/submissions";
import { extractResumeText } from "@/lib/resume-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "Online applications are temporarily unavailable.";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const fields = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));

  if (looksLikeBot(fields.website, fields.startedAt)) return NextResponse.json({ ok: true });
  if (await rateLimited(clientIp(req.headers))) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });
  }

  // Applying to a specific job opening: it must still be live.
  let opening: { id: string; title: string } | null = null;
  if (typeof fields.openingId === "string" && fields.openingId) {
    const live = isDbConfigured() ? await getLiveOpeningById(fields.openingId).catch(() => null) : null;
    if (!live) return NextResponse.json({ ok: false, error: "This opening is no longer accepting applications." }, { status: 410 });
    opening = { id: live.id, title: live.title };
  }

  const resume = form.get("resume");
  const file = resume instanceof File ? resume : null;
  const { data, errors } = validateApplication(fields, file, opening ? { fixedPosition: opening.title } : {});
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const buffer = Buffer.from(await file!.arrayBuffer());
  // The file's own bytes must show a real PDF or Word document of the type it
  // claims, without macros or scripts (same check as the CV upload form).
  const ext: CvExtension = (RESUME_TYPES[file!.type] as CvExtension | undefined) ?? fileExtension(file!.name) ?? "pdf";
  const check = inspectCvFile(buffer, ext);
  if (!check.ok) return NextResponse.json({ ok: false, errors: { resume: check.reason } }, { status: 422 });
  const safeName = `${data.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume.${ext}`;
  const settings = await getSettings();
  const willEmail = settings.notifyApplications && isMailConfigured();

  // Keep the resume in private storage so it can be opened from the admin panel.
  let resumeRef = null;
  if (isDbConfigured() && isStorageConfigured()) {
    try {
      const stored = await storeResume({ file: buffer, ext, contentType: file!.type || "application/octet-stream" });
      resumeRef = { path: stored.path, name: file!.name.slice(0, 180), size: buffer.length, type: file!.type || "" };
    } catch (err) {
      console.error("[careers] resume storage failed", err instanceof Error ? err.message : err);
    }
  }

  const submittedAt = new Date().toISOString();
  let closed = false;
  const saved = await saveSubmission("careers", async () => {
    try {
      return await recordApplication({
        candidate: { email: data.email, fullName: data.fullName, phone: data.phone },
        openingId: opening?.id ?? null,
        source: opening ? "job" : "careers",
        position: data.position,
        experience: data.experience,
        message: data.message,
        details: { consentVersion: CONSENT_VERSION, consentAt: submittedAt },
        resume: resumeRef,
        resumeText: resumeRef ? extractResumeText(buffer, ext) : null,
        submissionKey: typeof fields.submissionId === "string" ? fields.submissionId : null,
      });
    } catch (err) {
      if (err instanceof OpeningClosedError) {
        closed = true;
        return null;
      }
      throw err;
    }
  });

  // A stored resume that no application points to would be an orphan: remove it.
  if (resumeRef && (!saved || saved.duplicate)) await deleteStoredFile(resumeRef.path).catch(() => undefined);

  // The opening closed between loading the form and saving it.
  if (closed) return NextResponse.json({ ok: false, error: "This opening is no longer accepting applications." }, { status: 410 });

  // The same submission arrived twice (a retry or double click): it is already saved and was already emailed.
  if (saved?.duplicate) return NextResponse.json({ ok: true });

  // Not stored anywhere and no email possible: don't pretend it worked.
  if (!saved && !willEmail) {
    console.error("[careers] application not saved: database and email both unavailable");
    return NextResponse.json({ ok: false, error: UNAVAILABLE }, { status: 503 });
  }

  if (willEmail) {
    const rows: [string, string][] = [
      ["Full name", data.fullName],
      ["Email", data.email],
      ["Phone", data.phone],
      ["Position", data.position],
      ["Experience", data.experience],
      ["Message", data.message],
      ["Consent", `Given ${submittedAt} (policy version ${CONSENT_VERSION})`],
    ];
    if (saved) rows.push(["Admin reference", `#${saved.number}${saved.repeat ? " (has applied before)" : ""}`]);
    try {
      await sendMail({
        to: settings.applicationsEmail,
        replyTo: data.email,
        subject: `Job application: ${data.position} – ${data.fullName}`,
        text: rows.map(([k, v]) => `${k}: ${v || "—"}`).join("\n"),
        html: tableHtml("New job application from vmrcloudsolutions.com", rows),
        attachments: [{ filename: safeName, content: buffer, contentType: file!.type || undefined }],
      });
    } catch (err) {
      console.error("[careers] send failed", err instanceof Error ? err.message : err);
      if (!saved) return NextResponse.json({ ok: false, error: "We couldn't send your application just now." }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}
