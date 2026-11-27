import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { getCandidateFileRef } from "@/lib/data/talent";
import { readStoredFile, StorageNotConfiguredError } from "@/lib/cv-storage";
import { logActivity } from "@/lib/data/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/** Streams a resume uploaded to a candidate's profile. Never cached. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await assertAdmin("resumes.download");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const ref = await getCandidateFileRef(id);
  if (!ref) return new NextResponse("Resume not found.", { status: 404 });
  let file;
  try {
    file = await readStoredFile(ref.file_path);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return new NextResponse("File storage is not connected.", { status: 503 });
    console.error("[admin] candidate file read failed", err instanceof Error ? err.message : err);
    return new NextResponse("The file couldn't be opened just now.", { status: 502 });
  }
  if (!file) return new NextResponse("Resume not found in storage.", { status: 404 });
  const ext = ref.file_type;
  const base = ref.file_name.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume";
  const inline = new URL(req.url).searchParams.get("view") === "1" && ext === "pdf";
  await logActivity(me.id, "download", "candidate", ref.candidate_id, `Opened the resume ${ref.file_name}`);
  return new NextResponse(file.body as BodyInit, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${base}.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
    },
  });
}
