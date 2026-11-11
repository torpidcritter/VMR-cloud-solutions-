/**
 * Content checks for uploaded CVs. The browser-supplied name and type are
 * not trusted: the file's own bytes must show it is a real PDF or Word
 * document of the type its extension claims, without active content
 * (scripts, macros, embedded executables).
 *
 * This is a structural check, not an antivirus scan. Files are stored
 * privately and never served from the website.
 */
import type { CvExtension } from "./cv";

export type FileCheck = { ok: true; kind: CvExtension } | { ok: false; reason: string };

const BAD_FILE = "This file couldn't be accepted. Please upload a standard PDF or Word document.";
const ACTIVE = "This file contains active content (such as macros or scripts). Please save it as a plain PDF or Word document and try again.";

const startsWith = (buf: Uint8Array, bytes: number[]) => bytes.every((b, i) => buf[i] === b);

const PDF_SIG = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIG = [0x50, 0x4b, 0x03, 0x04]; // PK..
const OLE_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function latin1(buf: Uint8Array) {
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("latin1");
}

function utf16(s: string) {
  return Buffer.from(s, "utf16le");
}

function checkPdf(buf: Uint8Array): FileCheck {
  // Decode #xx escapes so names like /J#61vaScript can't hide.
  const text = latin1(buf).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  if (!/%%EOF/.test(text.slice(-2048))) return { ok: false, reason: BAD_FILE };
  if (/\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)(?![A-Za-z])/.test(text)) return { ok: false, reason: ACTIVE };
  return { ok: true, kind: "pdf" };
}

/** Lists file names from the ZIP central directory (no decompression). */
function zipEntries(buf: Uint8Array): string[] | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End of central directory record is in the last 64 KB + 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count === 0 || count > 2000 || offset >= buf.length) return null;
  const names: string[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    if (offset + 46 + nameLen > buf.length) return null;
    names.push(Buffer.from(buf.subarray(offset + 46, offset + 46 + nameLen)).toString("utf8"));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function checkDocx(buf: Uint8Array): FileCheck {
  const names = zipEntries(buf);
  if (!names) return { ok: false, reason: BAD_FILE };
  const lower = names.map((n) => n.toLowerCase());
  if (!lower.includes("[content_types].xml") || !lower.includes("word/document.xml")) return { ok: false, reason: BAD_FILE };
  if (lower.some((n) => n.includes("..") || n.startsWith("/"))) return { ok: false, reason: BAD_FILE };
  if (lower.some((n) => n.endsWith("vbaproject.bin") || n.includes("activex/") || /\.(exe|dll|bat|cmd|com|scr|js|vbs|ps1|jar|msi)$/.test(n))) {
    return { ok: false, reason: ACTIVE };
  }
  return { ok: true, kind: "docx" };
}

function checkDoc(buf: Uint8Array): FileCheck {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (!b.includes(utf16("WordDocument"))) return { ok: false, reason: BAD_FILE };
  if (b.includes(utf16("_VBA_PROJECT")) || b.includes(utf16("Macros"))) return { ok: false, reason: ACTIVE };
  return { ok: true, kind: "doc" };
}

export function inspectCvFile(buf: Uint8Array, ext: CvExtension): FileCheck {
  if (buf.length < 64) return { ok: false, reason: BAD_FILE };
  let detected: CvExtension | null = null;
  if (startsWith(buf, PDF_SIG)) detected = "pdf";
  else if (startsWith(buf, ZIP_SIG)) detected = "docx";
  else if (startsWith(buf, OLE_SIG)) detected = "doc";
  if (!detected || detected !== ext) return { ok: false, reason: "The file's contents don't match its type. Please upload a genuine PDF, DOC or DOCX file." };
  if (detected === "pdf") return checkPdf(buf);
  if (detected === "docx") return checkDocx(buf);
  return checkDoc(buf);
}
