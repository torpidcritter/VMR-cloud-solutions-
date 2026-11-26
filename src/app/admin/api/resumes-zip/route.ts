import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { resumeRefs } from "@/lib/data/bulk";
import { readStoredFile, StorageNotConfiguredError } from "@/lib/cv-storage";
import { logActivity } from "@/lib/data/activity";
import { sameOrigin } from "@/lib/guard";
import { zip } from "@/lib/zip";
import { bulkSelection } from "../../filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** At most this many resumes per download. */
const ZIP_MAX_FILES = 100;
/** Keeps the response under the hosting limit for a function response (4.5 MB). */
const ZIP_MAX_BYTES = 4 * 1024 * 1024;

async function toBuffer(body: ReadableStream<Uint8Array> | Buffer, limit: number) {
  if (Buffer.isBuffer(body)) return body;
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "candidate";

/**
 * Bundles the stored resumes of the selected applications into one ZIP.
 * POST from the applications page only (same origin), for roles that may
 * download resumes. Files that don't fit are listed in not-included.txt.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return new NextResponse("Forbidden.", { status: 403 });
  let me;
  try {
    me = await assertAdmin("resumes.download");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const form = await req.formData();
  const ids = await bulkSelection(form, can(me.role, "openings.viewClient"), me.id, 500);
  const refs = await resumeRefs(ids);
  if (!refs.length) return new NextResponse("None of the selected applications has a resume on file.", { status: 404 });

  const files: { name: string; data: Buffer }[] = [];
  const left: string[] = [];
  let total = 0;
  try {
    for (const r of refs) {
      const label = `#${r.number} ${r.full_name}`;
      if (files.length >= ZIP_MAX_FILES) {
        left.push(`${label}: more than ${ZIP_MAX_FILES} resumes were selected`);
        continue;
      }
      const file = await readStoredFile(r.resume_path);
      if (!file) {
        left.push(`${label}: the file is missing from storage`);
        continue;
      }
      const data = await toBuffer(file.body, ZIP_MAX_BYTES - total);
      if (!data || total + data.length > ZIP_MAX_BYTES) {
        left.push(`${label}: the download reached its 4 MB size limit`);
        continue;
      }
      total += data.length;
      const ext = r.resume_path.split(".").pop() ?? "pdf";
      files.push({ name: `${r.number}-${safe(r.full_name)}.${ext}`, data });
    }
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return new NextResponse("File storage is not connected.", { status: 503 });
    console.error("[admin] resume zip failed", err instanceof Error ? err.message : err);
    return new NextResponse("The resumes couldn't be read just now.", { status: 502 });
  }
  if (!files.length) return new NextResponse("None of the selected resumes could be read.", { status: 404 });
  if (left.length) files.push({ name: "not-included.txt", data: Buffer.from(`These resumes were not included. Download them separately or in a smaller batch.\r\n\r\n${left.join("\r\n")}\r\n`, "utf8") });

  const body = zip(files);
  const count = files.length - (left.length ? 1 : 0);
  await logActivity(me.id, "download", "application", null, `Downloaded ${count} resume${count === 1 ? "" : "s"} as a ZIP`);
  const date = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="vmr-resumes-${date}.zip"`,
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Resumes-Included": String(count),
      "X-Resumes-Left-Out": String(left.length),
    },
  });
}
