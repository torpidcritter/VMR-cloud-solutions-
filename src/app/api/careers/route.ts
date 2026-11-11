import { NextResponse } from "next/server";
import { RESUME_TYPES, validateApplication } from "@/lib/forms";
import { clientIp, looksLikeBot, rateLimited } from "@/lib/guard";
import { MailNotConfiguredError, sendMail, tableHtml } from "@/lib/mailer";
import { site } from "@/content/site";

export const runtime = "nodejs";

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

  const resume = form.get("resume");
  const file = resume instanceof File ? resume : null;
  const { data, errors } = validateApplication(fields, file);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const buffer = Buffer.from(await file!.arrayBuffer());
  // Basic content check: PDF or Office (OLE / ZIP) signatures only.
  const sig = buffer.subarray(0, 4).toString("hex");
  if (!["25504446", "d0cf11e0", "504b0304"].includes(sig)) {
    return NextResponse.json({ ok: false, errors: { resume: "Please upload a PDF or Word document." } }, { status: 422 });
  }
  const ext = RESUME_TYPES[file!.type] || file!.name.split(".").pop()?.toLowerCase() || "pdf";
  const safeName = `${data.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume.${ext}`;

  const rows: [string, string][] = [
    ["Full name", data.fullName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Position", data.position],
    ["Experience", data.experience],
    ["Message", data.message],
  ];

  try {
    await sendMail({
      to: process.env.CAREERS_TO || site.email.hr,
      replyTo: data.email,
      subject: `Job application: ${data.position} – ${data.fullName}`,
      text: rows.map(([k, v]) => `${k}: ${v || "—"}`).join("\n"),
      html: tableHtml("New job application from vmrcloudsolutions.com", rows),
      attachments: [{ filename: safeName, content: buffer, contentType: file!.type || undefined }],
    });
  } catch (err) {
    console.error("[careers] send failed", err);
    const notConfigured = err instanceof MailNotConfiguredError;
    return NextResponse.json(
      { ok: false, error: notConfigured ? "Online applications are temporarily unavailable." : "We couldn't send your application just now." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
