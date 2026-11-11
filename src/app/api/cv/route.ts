import { NextResponse } from "next/server";
import { CONSENT_VERSION, CV_MAX_BYTES, CV_MIME, fileExtension, validateCv } from "@/lib/cv";
import { isStorageConfigured, storeCv } from "@/lib/cv-storage";
import { inspectCvFile } from "@/lib/file-check";
import { clientIp, looksLikeBot, rateLimited, sameOrigin } from "@/lib/guard";
import { isMailConfigured, sendMail, tableHtml } from "@/lib/mailer";
import { site } from "@/content/site";

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

  if (!isStorageConfigured() || !isMailConfigured()) {
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
  if (rateLimited(clientIp(req.headers))) {
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

  // The CV is safely stored; the email tells the recruitment team about it.
  const rows: [string, string][] = [
    ["Full name", data.fullName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Current location", data.location],
    ["SAP specialisation", data.specialisation],
    ["Total experience", data.experience],
    ["Employment type", data.employmentType],
    ["Consent", `Given ${submittedAt} (policy version ${CONSENT_VERSION})`],
    ["Reference", stored.id],
    ["Stored at", `${stored.driver === "vercel-blob" ? "Vercel Blob (private)" : "Server storage"}: ${stored.cvPath}`],
  ];
  const safeName = `${data.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate"}-CV.${ext}`;
  try {
    await sendMail({
      to: process.env.CV_TO || process.env.CAREERS_TO || site.email.hr,
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
