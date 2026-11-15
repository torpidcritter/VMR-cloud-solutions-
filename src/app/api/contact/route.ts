import { NextResponse } from "next/server";
import { validateEnquiry } from "@/lib/forms";
import { clientIp, looksLikeBot, rateLimited } from "@/lib/guard";
import { MailNotConfiguredError, sendMail, tableHtml } from "@/lib/mailer";
import { site } from "@/content/site";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Bots get a quiet "success" so they don't retry; nothing is sent.
  if (looksLikeBot(body.website, body.startedAt)) return NextResponse.json({ ok: true });
  if (rateLimited(clientIp(req.headers))) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });
  }

  const { data, errors } = validateEnquiry(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const rows: [string, string][] = [
    ["Name", data.name],
    ["Company", data.company],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Service", data.service],
    ["Project requirement", data.requirement],
    ["Message", data.message],
  ];

  try {
    await sendMail({
      to: process.env.CONTACT_TO || site.email.general,
      replyTo: data.email,
      subject: `Website enquiry: ${data.service} – ${data.name}${data.company ? ` (${data.company})` : ""}`,
      text: rows.map(([k, v]) => `${k}: ${v || "—"}`).join("\n"),
      html: tableHtml("New business enquiry from vmrcloudsolutions.com", rows),
    });
  } catch (err) {
    console.error("[contact] send failed", err);
    const notConfigured = err instanceof MailNotConfiguredError;
    return NextResponse.json(
      { ok: false, error: notConfigured ? "Online enquiries are temporarily unavailable." : "We couldn't send your enquiry just now." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
