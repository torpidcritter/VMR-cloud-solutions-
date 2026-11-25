import { NextResponse } from "next/server";
import { RESUME_TYPES, validateApplication } from "@/lib/forms";
import { clientIp, looksLikeBot, rateLimited } from "@/lib/guard";
import { isMailConfigured, sendMail, tableHtml } from "@/lib/mailer";
import { isStorageConfigured, storeResume } from "@/lib/cv-storage";
import { isDbConfigured } from "@/lib/db/client";
import { getLiveOpeningById } from "@/lib/data/openings";
import { recordApplication } from "@/lib/data/applications";
import { getSettings } from "@/lib/data/settings";
import { saveSubmission } from "@/lib/submissions";

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
  if (rateLimited(clientIp(req.headers))) {
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
  // Basic content check: PDF or Office (OLE / ZIP) signatures only.
  const sig = buffer.subarray(0, 4).toString("hex");
  if (!["25504446", "d0cf11e0", "504b0304"].includes(sig)) {
    return NextResponse.json({ ok: false, errors: { resume: "Please upload a PDF or Word document." } }, { status: 422 });
  }
  const ext = RESUME_TYPES[file!.type] || file!.name.split(".").pop()?.toLowerCase() || "pdf";
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

  const saved = await saveSubmission("careers", () =>
    recordApplication({
      candidate: { email: data.email, fullName: data.fullName, phone: data.phone },
      openingId: opening?.id ?? null,
      source: opening ? "job" : "careers",
      position: data.position,
      experience: data.experience,
      message: data.message,
      resume: resumeRef,
    }),
  );

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
