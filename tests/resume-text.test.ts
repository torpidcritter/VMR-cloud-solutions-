import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "@/lib/resume-text";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

/** A tiny hand-made PDF: one page, a compressed content stream and a two-byte font with a ToUnicode map. */
function handMadePdf({ packed = false } = {}) {
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <0053> <0002> <0041> endbfchar 1 beginbfrange <0010> <0012> <0050> endbfrange endcmap end end`;
  const content = deflateSync(Buffer.from(`BT /F1 12 Tf 72 700 Td <00010002001000110012> Tj /F2 12 Tf 0 -14 Td [(ABAP) -300 (on) -300 (HANA)] TJ T* (Pune\\051) Tj ET`, "latin1"));
  const objs = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R /F2 7 0 R >> >> >>`,
    `<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>`,
    `<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n${content.toString("latin1")}\nendstream`,
    `<< /Type /Font /Subtype /Type0 /BaseFont /Test /Encoding /Identity-H /ToUnicode 6 0 R >>`,
    `<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ];
  let body = objs.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj\n`);
  if (packed) {
    // Move the two font dictionaries into a compressed object stream, as PDF 1.5+ writers do.
    const a = objs[4];
    const b = objs[6];
    const head = `5 0 7 ${a.length + 1} `;
    const data = deflateSync(Buffer.from(`${head}${a} ${b}`, "latin1"));
    body = body.filter((_, i) => i !== 4 && i !== 6);
    body.push(`8 0 obj\n<< /Type /ObjStm /N 2 /First ${head.length} /Length ${data.length} /Filter /FlateDecode >>\nstream\n${data.toString("latin1")}\nendstream\nendobj\n`);
  }
  return Buffer.from(`%PDF-1.7\n${body.join("")}trailer << /Root 1 0 R >>\n%%EOF\n`, "latin1");
}

describe("resume text extraction", () => {
  it("reads a PDF printed by a browser (fonts with ToUnicode maps)", () => {
    const r = extractResumeText(fixture("resume-chromium.pdf"), "pdf");
    expect(r.status).toBe("ok");
    expect(r.text).toContain("Test Candidate\nSAP FICO Consultant – 6 years. Expected ₹24 LPA.\nSkills\nSAP FI, SAP CO, S/4HANA\nAsset Accounting and cutover");
  });

  it("decodes compressed content, two-byte fonts, kerning gaps and escapes", () => {
    const r = extractResumeText(handMadePdf(), "pdf");
    expect(r.text).toBe("SAPQR\nABAP on HANA\nPune)");
    expect(extractResumeText(handMadePdf({ packed: true }), "pdf").text).toBe("SAPQR\nABAP on HANA\nPune)");
  });

  it("reads DOCX paragraphs, tabs and entities", () => {
    const r = extractResumeText(fixture("resume.docx"), "docx");
    expect(r.status).toBe("ok");
    expect(r.text).toBe("Test Candidate\nSAP MM & SD – S/4HANA Pune");
  });

  it("finds text runs in an old Word file", () => {
    const body = Buffer.from("Test Candidate, SAP Basis administrator with eight years of support work", "utf16le");
    const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512), body, Buffer.alloc(64)]);
    expect(extractResumeText(doc, "doc").text).toContain("SAP Basis administrator");
  });

  it("gives up quietly on files with nothing to read", () => {
    expect(extractResumeText(Buffer.from("%PDF-1.4\n%%EOF\n"), "pdf")).toEqual({ status: "empty", text: "" });
    expect(extractResumeText(Buffer.from("PK\u0003\u0004 not a real zip"), "docx").status).not.toBe("ok");
    expect(extractResumeText(Buffer.alloc(10), "txt").status).toBe("empty");
  });

  it("stops a decompression bomb instead of filling memory", () => {
    const bomb = deflateSync(Buffer.alloc(64 * 1024 * 1024, 0x20));
    const pdf = Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /Page /Contents 2 0 R >>\nendobj\n2 0 obj\n<< /Length ${bomb.length} /Filter /FlateDecode >>\nstream\n${bomb.toString("latin1")}\nendstream\nendobj\n%%EOF\n`, "latin1");
    const started = Date.now();
    const r = extractResumeText(pdf, "pdf");
    expect(r.status).not.toBe("ok");
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
