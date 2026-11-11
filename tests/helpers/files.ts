/** Builders for small, valid test documents. */

export function pdf(body = "1 0 obj << /Type /Catalog >> endobj") {
  return Buffer.from(`%PDF-1.7\n${body}\n${"x".repeat(64)}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, "latin1");
}

/** A minimal ZIP (stored, no compression) containing the given file names. */
export function zip(names: string[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const n = Buffer.from(name, "utf8");
    const data = Buffer.from("<x/>");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

export function docx(extra: string[] = []) {
  return zip(["[Content_Types].xml", "_rels/.rels", "word/document.xml", ...extra]);
}

export function doc(extraStreams: string[] = []) {
  const header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const names = ["Root Entry", "WordDocument", ...extraStreams].map((s) => Buffer.from(s, "utf16le"));
  return Buffer.concat([header, Buffer.alloc(504), ...names, Buffer.alloc(64)]);
}
