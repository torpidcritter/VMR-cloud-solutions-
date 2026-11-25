import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { getResumeRef } from "@/lib/data/applications";
import { readStoredFile, StorageNotConfiguredError } from "@/lib/cv-storage";
import { logActivity } from "@/lib/data/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams a resume from private storage to a signed-in admin. Never cached. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await assertAdmin("resumes.download");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const ref = await getResumeRef(id);
  if (!ref?.resume_path) return new NextResponse("Resume not found.", { status: 404 });
  let file;
  try {
    file = await readStoredFile(ref.resume_path);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return new NextResponse("File storage is not connected.", { status: 503 });
    console.error("[admin] resume read failed", err instanceof Error ? err.message : err);
    return new NextResponse("The file couldn't be opened just now.", { status: 502 });
  }
  if (!file) return new NextResponse("Resume not found in storage.", { status: 404 });

  const ext = ref.resume_path.split(".").pop() ?? "pdf";
  const type = ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword";
  const name = `${ref.full_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate"}-${ref.number}.${ext}`;
  const inline = new URL(req.url).searchParams.get("view") === "1" && ext === "pdf";
  await logActivity(me.id, "download", "application", id, `Opened the resume for application #${ref.number}`);
  return new NextResponse(file.body as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
    },
  });
}
