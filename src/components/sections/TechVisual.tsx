import type { CSSProperties } from "react";

/**
 * Animated technology visual for page headers and the homepage.
 * A code editor types out a snippet line by line while a build pipeline
 * runs alongside, over softly flowing circuit traces. Pure CSS, with
 * transforms, opacity and clip-path only, and one shared 14s loop so
 * everything stays in sync. Static when the visitor prefers reduced motion.
 */

type Tok = [cls: keyof typeof tone, text: string];
type Snippet = { file: string; lang: string; lines: Tok[][] };

const tone = {
  k: "text-[#7cc4ff]", // keyword
  t: "text-[#b9a3ff]", // type / annotation
  f: "text-[#ffd479]", // function
  s: "text-[#8ee6b0]", // string
  c: "text-[#64748b]", // comment
  p: "text-slate-300", // plain
} as const;

export const snippets = {
  java: {
    file: "OrderService.java",
    lang: "Java",
    lines: [
      [["t", "@RestController"]],
      [["k", "public class "], ["t", "OrderService"], ["p", " {"]],
      [["t", "  @GetMapping"], ["p", "("], ["s", '"/orders/{id}"'], ["p", ")"]],
      [["k", "  public "], ["t", "Order "], ["f", "find"], ["p", "(Long id) {"]],
      [["k", "    return "], ["p", "repo."], ["f", "findById"], ["p", "(id)"]],
      [["p", "      ."], ["f", "orElseThrow"], ["p", "();"]],
      [["p", "  }"]],
      [["p", "}"]],
    ],
  },
  python: {
    file: "sync_orders.py",
    lang: "Python",
    lines: [
      [["c", "# sync orders into the ERP"]],
      [["k", "def "], ["f", "sync_orders"], ["p", "(api, erp):"]],
      [["p", "    orders = api."], ["f", "get"], ["p", "("], ["s", '"/orders"'], ["p", ")"]],
      [["k", "    for "], ["p", "order "], ["k", "in "], ["p", "orders:"]],
      [["p", "        erp."], ["f", "post"], ["p", "(order)"]],
      [["k", "    return "], ["f", "len"], ["p", "(orders)"]],
    ],
  },
  sap: {
    file: "z_material_report.abap",
    lang: "SAP ABAP",
    lines: [
      [["k", "SELECT "], ["p", "matnr, maktx"]],
      [["k", "  FROM "], ["p", "makt"]],
      [["k", "  INTO TABLE "], ["t", "@DATA"], ["p", "(lt_mat)"]],
      [["k", "  WHERE "], ["p", "spras = "], ["t", "@sy-langu"], ["p", "."]],
      [["k", "LOOP AT "], ["p", "lt_mat "], ["k", "INTO "], ["t", "DATA"], ["p", "(ls)."]],
      [["k", "  WRITE"], ["p", ": / ls-matnr, ls-maktx."]],
      [["k", "ENDLOOP"], ["p", "."]],
    ],
  },
  cloud: {
    file: "deploy.yaml",
    lang: "YAML",
    lines: [
      [["k", "service"], ["p", ": "], ["s", "orders-api"]],
      [["k", "runtime"], ["p", ": "], ["s", "java-21"]],
      [["k", "replicas"], ["p", ": "], ["t", "3"]],
      [["k", "health"], ["p", ": "], ["s", "/status"]],
      [["k", "pipeline"], ["p", ":"]],
      [["p", "  - "], ["f", "build"]],
      [["p", "  - "], ["f", "test"]],
      [["p", "  - "], ["f", "release"]],
    ],
  },
  api: {
    file: "enquiry.http",
    lang: "REST API",
    lines: [
      [["k", "POST "], ["p", "/api/enquiry"]],
      [["t", "Content-Type"], ["p", ": application/json"]],
      [["p", "{"]],
      [["s", '  "service"'], ["p", ": "], ["s", '"SAP Consulting"'], ["p", ","]],
      [["s", '  "stack"'], ["p", ": ["], ["s", '"Java"'], ["p", ", "], ["s", '"Python"'], ["p", "]"]],
      [["p", "}"]],
      [["c", "// 200 OK"]],
    ],
  },
} satisfies Record<string, Snippet>;

export type SnippetKey = keyof typeof snippets;

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

const traces = [
  "M0 18 H22 V40 H48",
  "M100 12 H78 V30 H60",
  "M0 72 H18 V88 H44",
  "M100 80 H84 V62 H70",
  "M30 100 V84 H52",
];

export function TechVisual({ code = "java", className = "" }: { code?: SnippetKey; className?: string }) {
  const s: Snippet = snippets[code];
  const stages = ["Build", "Test", "Deploy"];
  return (
    <div aria-hidden className={`tech relative mx-auto aspect-[1/1] w-full select-none ${className}`}>
      {/* circuit traces with light pulses */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {traces.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" className="stroke-brand-200" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path
              d={d}
              fill="none"
              stroke="#00C8FF"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={100}
              className="t-trace"
              style={v({ "--d": `${i * 1.1}s` })}
            />
          </g>
        ))}
      </svg>
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(66,125,244,0.18),transparent_70%)]" />

      {/* code editor */}
      <div className="anim-fade-up absolute left-0 top-[12%] w-[88%] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1430] shadow-[0_30px_70px_-30px_rgba(11,24,56,0.7)]">
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[0.68rem] text-slate-300">{s.file}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
            <span className="t-blink size-1.5 rounded-full bg-sky-brand" />
            {s.lang}
          </span>
        </div>
        <div className="relative px-4 py-4 font-mono text-[0.72rem] leading-[1.75] xl:text-[0.78rem]">
          {/* scanning highlight */}
          <div className="t-scan pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-sky-brand/0 via-sky-brand/[0.07] to-sky-brand/0" />
          {s.lines.map((line, i) => (
            <div key={i} className="flex gap-4 whitespace-pre">
              <span className="w-4 shrink-0 text-right text-slate-600">{i + 1}</span>
              <span className={`t-line t-line-${i} relative`}>
                {line.map(([c, text], j) => (
                  <span key={j} className={tone[c]}>
                    {text}
                  </span>
                ))}
                {i === s.lines.length - 1 && <span className="t-caret ml-0.5 inline-block h-[1.05em] w-[0.5em] translate-y-[0.15em] bg-sky-brand/80" />}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* pipeline card */}
      <div
        className="anim-fade-up absolute bottom-[3%] right-0 w-[64%] rounded-2xl border border-line bg-card p-4 shadow-[0_24px_60px_-28px_rgba(15,27,51,0.5)]"
        style={v({ "--d": "250ms" })}
      >
        <div className="flex items-center justify-between">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">Pipeline</p>
          <span className="font-mono text-[0.62rem] text-muted">main</span>
        </div>
        <ol className="mt-3 flex items-center">
          {stages.map((st, i) => (
            <li key={st} className="flex flex-1 items-center gap-2 last:flex-none">
              <span className="relative grid size-6 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
                <span className={`t-stage t-stage-${i} absolute inset-0 grid place-items-center rounded-full bg-emerald-500`}>
                  <svg viewBox="0 0 12 12" className="size-3 text-white">
                    <path d="m3 6.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
              <span className="text-[0.72rem] font-semibold text-ink-soft">{st}</span>
              {i < stages.length - 1 && <span className="mx-2 h-px flex-1 bg-line-strong" />}
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="t-progress h-full origin-left rounded-full bg-gradient-to-r from-brand-500 to-sky-brand" />
        </div>
      </div>

      {/* live status chip */}
      <div
        className="anim-fade-up absolute right-[2%] top-0 z-10 flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2 shadow-[0_14px_34px_-18px_rgba(15,27,51,0.45)]"
        style={v({ "--d": "400ms" })}
      >
        <span className="flex h-4 items-end gap-[3px]">
          {[0.9, 1.3, 0.7, 1.1].map((t, i) => (
            <span key={i} className="t-eq h-full w-[3px] origin-bottom rounded-sm bg-gradient-to-t from-brand-500 to-sky-brand" style={v({ "--t": `${t}s` })} />
          ))}
        </span>
        <span className="font-mono text-[0.68rem] font-semibold text-ink">API</span>
        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold text-emerald-600 dark:text-emerald-400">200 OK</span>
      </div>
    </div>
  );
}
