import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { crc32, zip } from "@/lib/zip";
import { isIsoDate } from "@/lib/dates";
import { analyticsRange } from "@/lib/analytics-range";
import { csvBody, csvCell } from "@/lib/csv";

/** Reads a ZIP back through its central directory, checking every header and CRC. */
function unzip(buf: Buffer) {
  const end = buf.length - 22;
  expect(buf.readUInt32LE(end)).toBe(0x06054b50);
  const count = buf.readUInt16LE(end + 10);
  const cdSize = buf.readUInt32LE(end + 12);
  let p = buf.readUInt32LE(end + 16);
  expect(p + cdSize).toBe(end);
  const out: { name: string; data: Buffer; method: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    expect(buf.readUInt32LE(local + 14)).toBe(crc);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect(data.length).toBe(usize);
    expect(crc32(data)).toBe(crc);
    out.push({ name, data, method });
    p += 46 + nlen;
  }
  return out;
}

describe("ZIP writer", () => {
  it("matches the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it("writes a valid archive, deflating only when it helps", () => {
    const text = Buffer.from("SAP Basis ".repeat(500));
    const random = Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 7919 + 13) % 256));
    const files = unzip(zip([{ name: "101-Test-Candidate.pdf", data: text }, { name: "102-Other.docx", data: random }, { name: "empty.txt", data: Buffer.alloc(0) }], new Date(2026, 10, 26, 10, 30)));
    expect(files.map((f) => f.name)).toEqual(["101-Test-Candidate.pdf", "102-Other.docx", "empty.txt"]);
    expect(files[0]).toMatchObject({ method: 8 });
    expect(files[0].data.equals(text)).toBe(true);
    expect(files[1].data.equals(random)).toBe(true);
    expect(files[2].data.length).toBe(0);
  });
});

describe("dates, ranges and CSV", () => {
  it("accepts only real calendar days", () => {
    expect(["2026-11-26", "2024-02-29"].map(isIsoDate)).toEqual([true, true]);
    expect(["2026-02-31", "2025-02-29", "2026-13-01", "26-11-2026", "", null, 20261126].map(isIsoDate)).toEqual([false, false, false, false, false, false, false]);
  });

  it("works out analytics ranges in IST", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India.
    const now = new Date("2026-12-31T20:00:00Z");
    expect(analyticsRange({}, now)).toEqual({ key: "90d", from: "2026-10-04", to: "2027-01-01" });
    expect(analyticsRange({ range: "30d" }, now)).toEqual({ key: "30d", from: "2026-12-03", to: "2027-01-01" });
    expect(analyticsRange({ range: "year" }, now)).toEqual({ key: "year", from: "2027-01-01", to: "2027-01-01" });
    expect(analyticsRange({ range: "all" }, now)).toEqual({ key: "all", from: undefined, to: undefined });
    expect(analyticsRange({ from: "2026-06-30", to: "2026-01-01" }, now)).toEqual({ key: "custom", from: "2026-01-01", to: "2026-06-30" });
    expect(analyticsRange({ from: "2026-02-31" }, now).key).toBe("90d");
  });

  it("neutralises spreadsheet formulas and quotes cells", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-2+3")).toBe(`"'-2+3"`);
    expect(csvCell(null)).toBe('""');
    expect(csvBody(["A", "B"], [[1, "x,y"]])).toBe('﻿"A","B"\r\n"1","x,y"');
  });
});
