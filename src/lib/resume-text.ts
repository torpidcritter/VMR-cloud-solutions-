/**
 * Basic text extraction from resumes (PDF, DOCX, DOC), for search and
 * matching. No external service and no third-party parser: the file never
 * leaves the server.
 *
 * It is deliberately forgiving. Anything it can't read gives an empty result
 * rather than an error, and every step is capped so a hostile file can't
 * use up memory or time. Scanned (image-only) PDFs have no text to find.
 */
import { inflateRawSync, inflateSync, constants as z } from "node:zlib";

export type ExtractResult = { status: "ok" | "empty" | "failed"; text: string };

const MAX_TEXT = 100_000; // characters kept
const MAX_INFLATE = 8 * 1024 * 1024; // bytes per decompressed stream
const MAX_TOTAL_INFLATE = 40 * 1024 * 1024; // bytes across one file

export function extractResumeText(buf: Buffer, ext: string): ExtractResult {
  try {
    const raw = ext === "pdf" ? pdfText(buf) : ext === "docx" ? docxText(buf) : ext === "doc" ? docText(buf) : "";
    const text = tidy(raw);
    return { status: text.length >= 20 ? "ok" : "empty", text: text.length >= 20 ? text : "" };
  } catch {
    return { status: "failed", text: "" };
  }
}

/** Collapses whitespace, drops control characters and caps the length. */
export function tidy(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f�﻿]/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\r?\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

/* ------------------------------------------------------------------ */
/* Inflate with limits                                                  */
/* ------------------------------------------------------------------ */

function budget() {
  let used = 0;
  return (fn: () => Buffer): Buffer | null => {
    if (used >= MAX_TOTAL_INFLATE) return null;
    try {
      const out = fn();
      used += out.length;
      return out;
    } catch {
      return null;
    }
  };
}

const inflate = (b: Buffer) => inflateSync(b, { maxOutputLength: MAX_INFLATE, finishFlush: z.Z_SYNC_FLUSH });
const inflateRaw = (b: Buffer) => inflateRawSync(b, { maxOutputLength: MAX_INFLATE, finishFlush: z.Z_SYNC_FLUSH });

/* ------------------------------------------------------------------ */
/* DOCX: a ZIP holding word/document.xml                                */
/* ------------------------------------------------------------------ */

function zipFile(buf: Buffer, wanted: string, take: ReturnType<typeof budget>): Buffer | null {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (name.toLowerCase() === wanted) {
      if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, Math.min(buf.length, start + size));
      if (method === 0) return Buffer.from(data);
      if (method === 8) return take(() => inflateRaw(data));
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? safeChar(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()],
  );
const safeChar = (cp: number) => (cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ");

function docxText(buf: Buffer) {
  const xml = zipFile(buf, "word/document.xml", budget());
  if (!xml) return "";
  return decodeXml(
    xml
      .toString("utf8")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, "")
      .replace(/<[^>]+>/g, ""),
  );
}

/* ------------------------------------------------------------------ */
/* DOC (Word 97-2003): pick out runs of readable text                   */
/* ------------------------------------------------------------------ */

function docText(buf: Buffer) {
  const out: string[] = [];
  // UTF-16 runs (most modern .doc files store text this way).
  const u16 = /(?:[\x20-\x7e -ɏ\r\t]\x00){6,}/g;
  for (const m of buf.toString("latin1").matchAll(u16)) out.push(Buffer.from(m[0], "latin1").toString("utf16le"));
  if (out.join("").length < 200) {
    // Older files keep 8-bit text: long runs of mostly letters and spaces.
    for (const m of buf.toString("latin1").matchAll(/[\x20-\x7e\r\t]{24,}/g)) if (/[a-z]{3,}.*\s.*[a-z]{3,}/i.test(m[0])) out.push(m[0]);
  }
  return out.join("\n").replace(/\r/g, "\n");
}

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */

type PdfObj = { dict: string; stream: Buffer | null };

/** Reads every indirect object, including those packed in object streams. */
function pdfObjects(buf: Buffer, take: ReturnType<typeof budget>) {
  const text = buf.toString("latin1");
  const objs = new Map<number, PdfObj>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endobj", start);
    if (end < 0) break;
    let body = text.slice(start, end);
    let stream: Buffer | null = null;
    const s = body.search(/\bstream\r?\n/);
    if (s >= 0) {
      const dataStart = start + s + (body[s + 6] === "\r" ? 8 : 7);
      const len = Number(/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(body.slice(0, s))?.[1]);
      let dataEnd = Number.isFinite(len) && len > 0 && dataStart + len <= end ? dataStart + len : text.lastIndexOf("endstream", end);
      if (dataEnd < dataStart) dataEnd = dataStart;
      stream = buf.subarray(dataStart, dataEnd);
      body = body.slice(0, s);
    }
    objs.set(Number(m[1]), { dict: body, stream });
    re.lastIndex = end;
  }
  // Object streams (PDF 1.5+) hold more objects, compressed.
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/ObjStm\b/.test(o.dict) || !o.stream) continue;
    const data = decodeStream(o, take);
    if (!data) continue;
    const n = Number(/\/N\s+(\d+)/.exec(o.dict)?.[1] ?? 0);
    const first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] ?? 0);
    const s = data.toString("latin1");
    const head = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < Math.min(n, head.length / 2); i++) {
      const num = head[i * 2];
      const from = first + head[i * 2 + 1];
      const to = i + 1 < n && head[i * 2 + 3] !== undefined ? first + head[i * 2 + 3] : s.length;
      if (!objs.has(num)) objs.set(num, { dict: s.slice(from, to), stream: null });
    }
  }
  return objs;
}

function decodeStream(o: PdfObj, take: ReturnType<typeof budget>): Buffer | null {
  if (!o.stream) return null;
  const filters = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.dict)?.[1] ?? "";
  const names = filters.match(/\/\w+/g) ?? [];
  if (!names.length) return o.stream;
  if (names.length === 1 && (names[0] === "/FlateDecode" || names[0] === "/Fl")) {
    if (/\/Predictor\s+([2-9]|1\d)/.test(o.dict)) return null; // used for images and xref data, not text
    return take(() => inflate(o.stream!));
  }
  return null;
}

const refOf = (s: string | undefined) => (s ? Number(/^\s*(\d+)\s+\d+\s+R/.exec(s)?.[1] ?? NaN) : NaN);

/** The value of /Key in a dictionary: an inline << >> dict, an [array], a reference or a simple token. */
function dictValue(dict: string, key: string): string | undefined {
  const i = dict.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
  if (i < 0) return undefined;
  let j = i + key.length + 1;
  while (/\s/.test(dict[j] ?? "")) j++;
  if (dict.startsWith("<<", j)) {
    let depth = 0;
    for (let k = j; k < dict.length - 1; k++) {
      if (dict.startsWith("<<", k)) {
        depth++;
        k++;
      }
      else if (dict.startsWith(">>", k)) {
        depth--;
        k++;
        if (!depth) return dict.slice(j, k + 1);
      }
    }
    return undefined;
  }
  if (dict[j] === "[") return dict.slice(j, dict.indexOf("]", j) + 1);
  const ref = /^(\d+\s+\d+\s+R)/.exec(dict.slice(j));
  if (ref) return ref[1];
  return /^[^\s/<>[\]]+|^\/[^\s/<>[\]]+/.exec(dict.slice(j))?.[0];
}

/** Follows a reference to its dictionary, or returns the inline value. */
function resolve(objs: Map<number, PdfObj>, v: string | undefined) {
  const n = refOf(v);
  return Number.isFinite(n) ? objs.get(n)?.dict : v;
}

type CMap = { map: Map<string, string>; bytes: number };

function parseCMap(s: string): CMap {
  const map = new Map<string, string>();
  const hexToStr = (h: string) => {
    let out = "";
    for (let i = 0; i + 4 <= h.length; i += 4) out += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    if (h.length % 4 === 2) out += String.fromCharCode(parseInt(h.slice(-2), 16));
    return out;
  };
  let bytes = 1;
  const space = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(s);
  if (space) bytes = Math.max(1, space[1].length / 2);
  for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(p[1].toLowerCase(), hexToStr(p[2]));
  }
  for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(p[1], 16);
      const hi = Math.min(parseInt(p[2], 16), lo + 0xffff);
      const width = p[1].length;
      if (p[3][0] === "[") {
        const items = [...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => x[1]);
        items.forEach((h, k) => lo + k <= hi && map.set((lo + k).toString(16).padStart(width, "0"), hexToStr(h)));
      } else {
        const base = p[3].slice(1, -1);
        const start = parseInt(base.slice(-4) || "0", 16);
        const prefix = hexToStr(base.slice(0, Math.max(0, base.length - 4)));
        for (let c = lo; c <= hi; c++) map.set(c.toString(16).padStart(width, "0"), prefix + String.fromCharCode(start + (c - lo)));
      }
    }
  }
  return { map, bytes };
}

/** Font name → its ToUnicode map, for one page's resources (inherited from parents too). */
function pageFonts(objs: Map<number, PdfObj>, page: string, take: ReturnType<typeof budget>, cache: Map<number, CMap | null>) {
  const fonts = new Map<string, CMap | null>();
  let node: string | undefined = page;
  for (let guard = 0; node && guard < 20; guard++) {
    const res = resolve(objs, dictValue(node, "Resources"));
    const fontDict = res ? resolve(objs, dictValue(res, "Font")) : undefined;
    if (fontDict) {
      for (const f of fontDict.matchAll(/\/([^\s/<>[\]]+)\s+(\d+)\s+\d+\s+R/g)) {
        if (fonts.has(f[1])) continue;
        const fontObj = objs.get(Number(f[2]))?.dict ?? "";
        const tu = refOf(dictValue(fontObj, "ToUnicode"));
        if (!Number.isFinite(tu)) {
          fonts.set(f[1], null);
          continue;
        }
        if (!cache.has(tu)) {
          const o = objs.get(tu);
          const data = o ? decodeStream(o, take) : null;
          cache.set(tu, data ? parseCMap(data.toString("latin1")) : null);
        }
        fonts.set(f[1], cache.get(tu)!);
      }
    }
    node = resolve(objs, dictValue(node, "Parent"));
  }
  return fonts;
}

function decodeBytes(bytes: Buffer, cmap: CMap | null | undefined) {
  if (!cmap || !cmap.map.size) return bytes.toString("latin1");
  let out = "";
  const w = cmap.bytes;
  for (let i = 0; i + w <= bytes.length; i += w) {
    const key = bytes.subarray(i, i + w).toString("hex");
    out += cmap.map.get(key) ?? (w === 1 ? String.fromCharCode(bytes[i]) : "");
  }
  return out;
}

/** Walks a content stream and returns its text, in drawing order. */
function contentText(data: Buffer, fonts: Map<string, CMap | null>) {
  const s = data.toString("latin1");
  const out: string[] = [];
  const stack: (Buffer | number | string | (Buffer | number)[])[] = [];
  let font: CMap | null | undefined;
  // Approximate text position, to tell a word gap or a new line from a kerning nudge.
  let size = 10;
  let scale = 1;
  let lead = 0;
  let x = 0;
  let lineX = 0;
  let lineY = 0;
  let started = false;
  let endX = 0;
  let endY = 0;
  // Positioning only moves the pen; spacing is decided when the next text is drawn.
  const moveTo = (nx: number, ny: number) => {
    lineX = x = nx;
    lineY = ny;
  };
  const show = (bytes: Buffer) => {
    const text = decodeBytes(bytes, font);
    const em = size * scale;
    if (started && Math.abs(lineY - endY) > em * 0.4) out.push("\n");
    else if (started && (x - endX > em * 0.2 || x < endX - em * 10)) out.push(" ");
    out.push(text);
    started = true;
    x += [...text].length * em * 0.5;
    endX = x;
    endY = lineY;
  };
  let i = 0;
  let arr: (Buffer | number)[] | null = null;
  const push = (v: Buffer | number | string) => (arr && typeof v !== "string" ? arr.push(v) : stack.push(v));
  while (i < s.length) {
    const c = s[i];
    if (c === "%") {
      while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++;
    } else if (/\s/.test(c)) i++;
    else if (c === "(") {
      // Literal string with nesting and escapes.
      const bytes: number[] = [];
      let depth = 1;
      i++;
      while (i < s.length && depth) {
        const ch = s[i];
        if (ch === "\\") {
          const n = s[i + 1];
          const map: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
          if (n in map) {
            bytes.push(map[n]);
            i += 2;
          }
          else if (/[0-7]/.test(n)) {
            const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))![0];
            bytes.push(parseInt(oct, 8) & 0xff);
            i += 1 + oct.length;
          } else i += 2; // line continuation or unknown escape
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")" && !--depth) break;
        bytes.push(ch.charCodeAt(0));
        i++;
      }
      i++;
      push(Buffer.from(bytes));
    } else if (c === "<" && s[i + 1] !== "<") {
      const end = s.indexOf(">", i);
      if (end < 0) break;
      let hex = s.slice(i + 1, end).replace(/[^0-9a-fA-F]/g, "");
      if (hex.length % 2) hex += "0";
      push(Buffer.from(hex, "hex"));
      i = end + 1;
    } else if (c === "[") {
      arr = [];
      i++;
    } else if (c === "]") {
      if (arr) stack.push(arr);
      arr = null;
      i++;
    } else if (c === "<" || c === ">") {
      i += 2; // dictionaries (inline images, marked content) are skipped
    } else if (c === "/") {
      const m = /^\/[^\s/<>[\]()%]*/.exec(s.slice(i, i + 128))![0];
      push(m);
      i += m.length;
    } else {
      const m = /^[^\s/<>[\]()%]+/.exec(s.slice(i, i + 64))?.[0] ?? c;
      i += m.length;
      const num = Number(m);
      if (m !== "" && Number.isFinite(num) && /^[-+.\d]/.test(m)) {
        push(num);
        continue;
      }
      // An operator.
      const nums = stack.filter((v): v is number => typeof v === "number");
      if (m === "Tf") {
        const name = stack.filter((v) => typeof v === "string").pop() as string | undefined;
        if (name) font = fonts.get(name.slice(1));
        size = Math.abs(nums.at(-1) ?? size) || size;
      } else if (m === "Tj" || m === "'" || m === '"') {
        const str = stack.filter(Buffer.isBuffer).pop();
        if (m !== "Tj") moveTo(lineX, lineY - lead);
        if (str) show(str);
      } else if (m === "TJ") {
        const a = stack.filter(Array.isArray).pop() ?? [];
        for (const part of a) {
          if (Buffer.isBuffer(part)) show(part);
          else {
            if (part < -180) out.push(" ");
            x -= (part / 1000) * size * scale;
            endX = x;
          }
        }
      } else if (m === "Td" || m === "TD") {
        const [tx = 0, ty = 0] = nums.slice(-2);
        if (m === "TD") lead = -ty * scale;
        moveTo(lineX + tx * scale, lineY + ty * scale);
      } else if (m === "TL") lead = (nums.at(-1) ?? 0) * scale;
      else if (m === "T*") moveTo(lineX, lineY - (lead || size * scale));
      else if (m === "Tm" && nums.length >= 6) {
        const [a, b, , , e, f] = nums.slice(-6);
        scale = Math.hypot(a, b) || 1;
        moveTo(e, f);
      } else if (m === "BT") {
        scale = 1;
      } else if (m === "BI") {
        // Inline image data: skip to EI.
        const ei = s.indexOf("EI", i);
        i = ei < 0 ? s.length : ei + 2;
      }
      stack.length = 0;
    }
    if (out.length > 200_000) break;
  }
  return out.join("");
}

function pdfText(buf: Buffer) {
  const take = budget();
  const objs = pdfObjects(buf, take);
  const cache = new Map<number, CMap | null>();
  const parts: string[] = [];
  const seen = new Set<number>();
  // Pages in object order, with their own fonts.
  for (const o of objs.values()) {
    if (!/\/Type\s*\/Page(?![s\w])/.test(o.dict)) continue;
    const fonts = pageFonts(objs, o.dict, take, cache);
    const contents = dictValue(o.dict, "Contents");
    const refs = contents?.startsWith("[") ? [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => Number(r[1])) : [refOf(contents)];
    for (const r of refs) {
      const c = objs.get(r);
      if (!c || seen.has(r)) continue;
      seen.add(r);
      const data = decodeStream(c, take);
      if (data) parts.push(contentText(data, fonts));
    }
    parts.push("\n");
    if (parts.join("").length > MAX_TEXT * 2) break;
  }
  return parts.join("");
}
