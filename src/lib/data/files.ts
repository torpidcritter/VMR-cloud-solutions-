import "server-only";
import { db } from "@/lib/db/client";
import { deleteAnyStoredPath, listStoredFiles } from "@/lib/cv-storage";

/**
 * Daily clean-up of stored files that no record points to: a job-application
 * resume kept when the database save then failed, or an admin upload whose
 * save failed. Only files older than a day are touched, so a submission still
 * being saved is safe. Upload CV folders (cv-submissions/) are never swept:
 * when the database is down they are the only copy of the submission.
 *
 * Safety stop: if most stored files look unreferenced (for example the app
 * is pointed at an empty database by mistake), nothing is deleted.
 */
export async function sweepOrphanFiles({ olderThanHours = 24, maxDeletes = 200 } = {}) {
  const files = await listStoredFiles();
  if (!files.length) return { checked: 0, deleted: 0, skipped: null as string | null };
  const conn = await db();
  const refs = await conn.query<{ p: string }>(
    `SELECT resume_path AS p FROM applications WHERE resume_path IS NOT NULL UNION SELECT file_path FROM candidate_files`,
  );
  const used = new Set(refs.map((r) => r.p));
  const cutoff = Date.now() - olderThanHours * 3600_000;
  const orphan = files.filter((f) => !f.path.startsWith("cv-submissions/") && f.uploadedAt.getTime() <= cutoff && !used.has(f.path));
  if (orphan.length > 10 && orphan.length > files.length / 2) {
    const why = `${orphan.length} of ${files.length} stored files have no record; not deleting anything. Check DATABASE_URL.`;
    console.error("[files] orphan sweep stopped:", why);
    return { checked: files.length, deleted: 0, skipped: why };
  }
  let deleted = 0;
  for (const f of orphan.slice(0, maxDeletes)) {
    try {
      await deleteAnyStoredPath(f.path);
      deleted++;
    } catch (err) {
      console.error("[files] could not delete", f.path, err instanceof Error ? err.message : err);
    }
  }
  return { checked: files.length, deleted, skipped: null };
}
