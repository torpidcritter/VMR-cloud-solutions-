import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isStorageConfigured, storeCv, StorageNotConfiguredError } from "@/lib/cv-storage";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("cv storage", () => {
  it("is not configured without a Blob token or local opt-in", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.CV_STORAGE;
    expect(isStorageConfigured()).toBe(false);
    await expect(storeCv({ file: Buffer.from("x"), ext: "pdf", contentType: "application/pdf", record: {} })).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it("never uses local disk on Vercel", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.CV_STORAGE = "local";
    process.env.VERCEL = "1";
    expect(isStorageConfigured()).toBe(false);
  });

  it("writes the CV and record to a private folder with no personal data in the path", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cv-"));
    delete process.env.VERCEL;
    process.env.CV_STORAGE = "local";
    process.env.CV_LOCAL_DIR = dir;
    const stored = await storeCv({ file: Buffer.from("%PDF-test"), ext: "pdf", contentType: "application/pdf", record: { candidate: { fullName: "Priya Sharma" } } });
    expect(stored.cvPath).toMatch(/^cv-submissions\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/cv\.pdf$/);
    expect(stored.cvPath).not.toMatch(/priya/i);
    const files = await readdir(path.join(dir, path.dirname(stored.cvPath)));
    expect(files.sort()).toEqual(["application.json", "cv.pdf"]);
    expect((await stat(path.join(dir, stored.cvPath))).mode & 0o777).toBe(0o600);
    const record = JSON.parse(await readFile(path.join(dir, stored.recordPath), "utf8"));
    expect(record.candidate.fullName).toBe("Priya Sharma");
  });
});
