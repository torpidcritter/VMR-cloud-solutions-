import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private storage for CV submissions.
 *
 * Production (Vercel): a *private* Vercel Blob store. Connect one to the
 * project (Storage → Create → Blob → access "Private"); Vercel then adds
 * BLOB_READ_WRITE_TOKEN to the environment. Private blobs have no public
 * URL and can only be read with the store token or from the Vercel dashboard.
 *
 * Self-hosted servers: CV_STORAGE=local writes to CV_LOCAL_DIR (default
 * ./.data/cv-submissions, outside /public, never served). Not available on
 * Vercel, whose filesystem is read-only and temporary.
 */

export class StorageNotConfiguredError extends Error {}

export type StoredCv = { id: string; driver: "vercel-blob" | "local"; cvPath: string; recordPath: string };

type Driver = "vercel-blob" | "local";

export function storageDriver(): Driver | null {
  if (process.env.CV_STORAGE === "local" && !process.env.VERCEL) return "local";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return null;
}

export function isStorageConfigured() {
  return storageDriver() !== null;
}

/** Stores the CV and a JSON record side by side under a random, PII-free path. */
export async function storeCv({
  file,
  ext,
  contentType,
  record,
}: {
  file: Buffer;
  ext: string;
  contentType: string;
  record: Record<string, unknown>;
}): Promise<StoredCv> {
  const driver = storageDriver();
  if (!driver) throw new StorageNotConfiguredError("CV storage is not configured");

  const now = new Date();
  const id = randomUUID();
  const folder = `cv-submissions/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}`;
  const cvPath = `${folder}/cv.${ext}`;
  const recordPath = `${folder}/application.json`;
  const json = JSON.stringify({ id, receivedAt: now.toISOString(), cvFile: cvPath, ...record }, null, 2);

  if (driver === "local") {
    const root = path.resolve(process.env.CV_LOCAL_DIR || path.join(process.cwd(), ".data"));
    const dir = path.join(root, folder);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(root, cvPath), file, { mode: 0o600, flag: "wx" });
    await writeFile(path.join(root, recordPath), json, { mode: 0o600, flag: "wx" });
    return { id, driver, cvPath, recordPath };
  }

  const { put } = await import("@vercel/blob");
  const common = { access: "private" as const, addRandomSuffix: false, allowOverwrite: false };
  await put(cvPath, file, { ...common, contentType });
  await put(recordPath, json, { ...common, contentType: "application/json" });
  return { id, driver, cvPath, recordPath };
}

/** Stores a resume sent with a job application (file only, PII-free path). */
export async function storeResume({ file, ext, contentType }: { file: Buffer; ext: string; contentType: string }): Promise<{ driver: Driver; path: string }> {
  const driver = storageDriver();
  if (!driver) throw new StorageNotConfiguredError("Resume storage is not configured");
  const now = new Date();
  const filePath = `applications/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}/resume.${ext}`;
  if (driver === "local") {
    const root = localRoot();
    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true, mode: 0o700 });
    await writeFile(path.join(root, filePath), file, { mode: 0o600, flag: "wx" });
    return { driver, path: filePath };
  }
  const { put } = await import("@vercel/blob");
  await put(filePath, file, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType });
  return { driver, path: filePath };
}

/** Stores a resume an admin uploaded to a candidate's profile (file only, PII-free path). */
export async function storeCandidateFile({ file, ext, contentType }: { file: Buffer; ext: string; contentType: string }): Promise<{ driver: Driver; path: string }> {
  const driver = storageDriver();
  if (!driver) throw new StorageNotConfiguredError("Resume storage is not configured");
  const now = new Date();
  const filePath = `candidates/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}/resume.${ext}`;
  if (driver === "local") {
    const root = localRoot();
    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true, mode: 0o700 });
    await writeFile(path.join(root, filePath), file, { mode: 0o600, flag: "wx" });
    return { driver, path: filePath };
  }
  const { put } = await import("@vercel/blob");
  await put(filePath, file, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType });
  return { driver, path: filePath };
}

function localRoot() {
  return path.resolve(process.env.CV_LOCAL_DIR || path.join(process.cwd(), ".data"));
}

/** Only paths this module writes may be read back or deleted. */
const STORED_PATH = /^(cv-submissions|applications|candidates)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/(cv|resume)\.(pdf|docx?)$/;

/** Reads a stored resume for the admin download route. Null if missing. */
export async function readStoredFile(filePath: string): Promise<{ body: ReadableStream<Uint8Array> | Buffer; contentType: string; size?: number } | null> {
  if (!STORED_PATH.test(filePath)) return null;
  const driver = storageDriver();
  if (!driver) throw new StorageNotConfiguredError("CV storage is not configured");
  if (driver === "local") {
    const { readFile } = await import("node:fs/promises");
    try {
      const body = await readFile(path.join(localRoot(), filePath));
      return { body, contentType: "application/octet-stream", size: body.length };
    } catch {
      return null;
    }
  }
  const { get } = await import("@vercel/blob");
  const res = await get(filePath, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return { body: res.stream, contentType: res.blob.contentType, size: res.blob.size };
}

export async function deleteStoredFile(filePath: string) {
  if (!STORED_PATH.test(filePath)) return;
  const driver = storageDriver();
  if (!driver) return;
  if (driver === "local") {
    const { rm } = await import("node:fs/promises");
    await rm(path.join(localRoot(), filePath), { force: true });
    return;
  }
  const { del } = await import("@vercel/blob");
  await del(filePath);
}
