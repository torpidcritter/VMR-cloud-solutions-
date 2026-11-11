import { describe, expect, it } from "vitest";
import { inspectCvFile } from "@/lib/file-check";
import { doc, docx, pdf, zip } from "./helpers/files";

describe("inspectCvFile", () => {
  it("accepts a plain PDF", () => {
    expect(inspectCvFile(pdf(), "pdf")).toEqual({ ok: true, kind: "pdf" });
  });

  it("rejects PDFs with JavaScript, launch actions or attachments", () => {
    for (const bad of ["/OpenAction << /S /JavaScript /JS (app.alert(1)) >>", "/AA << /O << /S /Launch >> >>", "/Names << /EmbeddedFiles 3 0 R >>"]) {
      expect(inspectCvFile(pdf(bad), "pdf").ok).toBe(false);
    }
  });

  it("decodes #xx escapes in PDF names before checking", () => {
    expect(inspectCvFile(pdf("/S /J#61vaScript"), "pdf").ok).toBe(false);
  });

  it("rejects a truncated PDF", () => {
    const b = pdf();
    expect(inspectCvFile(b.subarray(0, b.length - 8), "pdf").ok).toBe(false);
  });

  it("accepts a DOCX and rejects macro-enabled or non-Word ZIPs", () => {
    expect(inspectCvFile(docx(), "docx")).toEqual({ ok: true, kind: "docx" });
    expect(inspectCvFile(docx(["word/vbaProject.bin"]), "docx").ok).toBe(false);
    expect(inspectCvFile(docx(["word/activeX/activeX1.xml"]), "docx").ok).toBe(false);
    expect(inspectCvFile(docx(["payload.exe"]), "docx").ok).toBe(false);
    expect(inspectCvFile(zip(["[Content_Types].xml", "xl/workbook.xml"]), "docx").ok).toBe(false);
    expect(inspectCvFile(zip(["readme.txt", "a".repeat(80)]), "docx").ok).toBe(false);
  });

  it("accepts a DOC and rejects one with VBA macros", () => {
    expect(inspectCvFile(doc(), "doc")).toEqual({ ok: true, kind: "doc" });
    expect(inspectCvFile(doc(["Macros", "_VBA_PROJECT"]), "doc").ok).toBe(false);
  });

  it("rejects files whose contents don't match the extension", () => {
    expect(inspectCvFile(pdf(), "docx").ok).toBe(false);
    expect(inspectCvFile(docx(), "pdf").ok).toBe(false);
    expect(inspectCvFile(Buffer.from("MZ" + "\0".repeat(200)), "pdf").ok).toBe(false);
    expect(inspectCvFile(Buffer.from("<html><script>alert(1)</script></html>".padEnd(100)), "doc").ok).toBe(false);
  });

  it("rejects tiny files", () => {
    expect(inspectCvFile(Buffer.from("%PDF-1.4"), "pdf").ok).toBe(false);
  });
});
