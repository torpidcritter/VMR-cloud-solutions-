import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportApplications } from "@/lib/data/applications";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import { applicationFilters } from "../../filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Spreadsheet apps run cells starting with = + - @ as formulas; neutralise them. */
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  let me;
  try {
    me = await assertAdmin("applications.export");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const showClient = can(me.role, "openings.viewClient");
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { filters } = applicationFilters(sp, showClient, me.id);
  const rows = await exportApplications(filters);
  const head = ["Number", "Received (IST)", "Name", "Email", "Phone", "Location", "Position", "Job opening", ...(showClient ? ["Client"] : []), "Source", "Experience", "Specialisation", "Status", "Recruiter", "Resume", "Message"];
  const lines = rows.map((r) =>
    [
      r.number,
      new Date(r.submitted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      r.full_name,
      r.email,
      r.phone,
      r.location,
      r.position,
      r.opening_title ?? "",
      ...(showClient ? [r.client_name ?? ""] : []),
      APPLICATION_SOURCE_LABELS[r.source] ?? r.source,
      r.experience,
      r.specialisation,
      APPLICATION_STATUS_LABELS[r.status] ?? r.status,
      r.assigned_name ?? "",
      r.resume_path ? "Yes" : "No",
      r.message,
    ]
      .map(cell)
      .join(","),
  );
  await logActivity(me.id, "export", "application", null, `Exported ${rows.length} application${rows.length === 1 ? "" : "s"} to CSV`);
  const date = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return new NextResponse(`﻿${[head.map(cell).join(","), ...lines].join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vmr-applications-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
