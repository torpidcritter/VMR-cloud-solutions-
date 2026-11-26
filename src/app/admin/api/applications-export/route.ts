import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportApplications } from "@/lib/data/applications";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import { applicationFilters, bulkSelection } from "../../filters";
import { BULK_LIMIT } from "@/lib/data/bulk";
import { sameOrigin } from "@/lib/guard";
import { csvCell as cell } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signedIn() {
  try {
    return await assertAdmin("applications.export");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
}

/** Everything matching the filters in the query string. */
export async function GET(req: Request) {
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const showClient = can(me.role, "openings.viewClient");
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { filters } = applicationFilters(sp, showClient, me.id);
  return csv(me, showClient, await exportApplications(filters));
}

/** A bulk selection from the applications page (ids, or all matching the filters). */
export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return new NextResponse("Forbidden.", { status: 403 });
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const showClient = can(me.role, "openings.viewClient");
  const ids = await bulkSelection(await req.formData(), showClient, me.id, BULK_LIMIT);
  if (!ids.length) return new NextResponse("Select at least one application.", { status: 400 });
  return csv(me, showClient, await exportApplications({ ids }));
}

async function csv(me: { id: string }, showClient: boolean, rows: Awaited<ReturnType<typeof exportApplications>>) {
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
