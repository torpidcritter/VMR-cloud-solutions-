import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { byClient, byOpening, byRecruiter, bySource, hiresByRecruiter, skillDemand, type Breakdown } from "@/lib/data/analytics";
import { pipelineConversion } from "@/lib/data/applications";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { analyticsRange } from "@/lib/analytics-range";
import { csvBody, csvHeaders } from "@/lib/csv";
import { logActivity } from "@/lib/data/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECTIONS = ["funnel", "sources", "recruiters", "openings", "clients", "skills"] as const;
const rowsOf = (rows: Breakdown[], label = (r: Breakdown) => r.label) => rows.map((r) => [label(r), r.applications, r.shortlisted, r.interviewed, r.hired]);
const BREAKDOWN_HEAD = ["Applications", "Shortlisted or further", "Interviewed or further", "Hired"];

export async function GET(req: Request) {
  let me;
  try {
    me = await assertAdmin("analytics.view");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const section = (SECTIONS as readonly string[]).includes(sp.section) ? (sp.section as (typeof SECTIONS)[number]) : null;
  if (!section) return new NextResponse("Unknown report.", { status: 400 });
  // Client figures are confidential to roles that may see client names.
  if (section === "clients" && !(can(me.role, "openings.viewClient") && can(me.role, "clients.view"))) return new NextResponse("Your role doesn't allow this.", { status: 403 });
  const range = analyticsRange({ from: sp.from, to: sp.to, range: sp.from || sp.to ? undefined : "all" });
  const r = { from: range.from, to: range.to };

  let head: string[];
  let rows: unknown[][];
  switch (section) {
    case "funnel": {
      const f = await pipelineConversion(r);
      head = ["Stage", "Reached", "Share of all applications"];
      rows = f.stages.map((s) => [APPLICATION_STATUS_LABELS[s.stage], s.count, `${Math.round(s.ofTotal * 100)}%`]);
      break;
    }
    case "sources":
      head = ["Source", ...BREAKDOWN_HEAD];
      rows = rowsOf(await bySource(r), (x) => APPLICATION_SOURCE_LABELS[x.key as keyof typeof APPLICATION_SOURCE_LABELS] ?? x.label);
      break;
    case "recruiters": {
      const [list, hires] = await Promise.all([byRecruiter(r), hiresByRecruiter(r)]);
      const by = new Map(hires.map((h) => [h.key, h.hires]));
      head = ["Recruiter", "Assigned", "Shortlisted or further", "Interviewed or further", "Hires made in period"];
      rows = list.map((x) => [x.label, x.applications, x.shortlisted, x.interviewed, by.get(x.key) ?? 0]);
      break;
    }
    case "openings":
      head = ["Opening", ...BREAKDOWN_HEAD];
      rows = rowsOf(await byOpening(r));
      break;
    case "clients":
      head = ["Client", ...BREAKDOWN_HEAD];
      rows = rowsOf(await byClient(r));
      break;
    case "skills":
      head = ["Skill", "Open roles asking", "Profiles with it"];
      rows = (await skillDemand(100)).map((s) => [s.skill, s.openings, s.candidates]);
      break;
  }
  await logActivity(me.id, "export", "analytics", null, `Exported the ${section} report${r.from || r.to ? ` (${r.from ?? "start"} to ${r.to ?? "today"})` : ""}`);
  return new NextResponse(csvBody(head, rows), { headers: csvHeaders(`vmr-${section}-${r.from ?? "all"}-${r.to ?? "today"}.csv`) });
}
