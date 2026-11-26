import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { LOGIN_OUTCOME_LABELS, listActivity, listLogins } from "@/lib/data/audit";
import { logActivity } from "@/lib/data/activity";
import { csvBody, csvHeaders } from "@/lib/csv";
import { auditFilters } from "../../audit-filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
const ist = (v: string) => new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

/** The filtered audit log (or sign-in records) as CSV, newest first, up to 10,000 rows. */
export async function GET(req: Request) {
  let me;
  try {
    me = await assertAdmin("activity.view");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const { tab, activity, logins } = auditFilters(Object.fromEntries(new URL(req.url).searchParams));
  const date = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  let body: string;
  let count: number;
  if (tab === "signins") {
    const { rows } = await listLogins(logins, { limit: MAX_ROWS });
    count = rows.length;
    body = csvBody(
      ["When (IST)", "Result", "Name", "Email typed", "IP address", "Browser"],
      rows.map((r) => [ist(r.created_at), LOGIN_OUTCOME_LABELS[r.outcome] ?? r.outcome, r.user_name ?? "", r.email, r.ip, r.user_agent]),
    );
  } else {
    const { rows } = await listActivity(activity, { limit: MAX_ROWS });
    count = rows.length;
    body = csvBody(
      ["When (IST)", "Who", "Action", "Record type", "Record id", "Details"],
      rows.map((r) => [ist(r.created_at), r.user_name ?? "", r.action, r.entity, r.entity_id ?? "", r.summary]),
    );
  }
  await logActivity(me.id, "export", "audit", null, `Exported ${count} ${tab === "signins" ? "sign-in record" : "activity entr"}${tab === "signins" ? (count === 1 ? "" : "s") : count === 1 ? "y" : "ies"} to CSV`);
  return new NextResponse(body, { headers: csvHeaders(`vmr-${tab === "signins" ? "sign-ins" : "activity"}-${date}.csv`) });
}
