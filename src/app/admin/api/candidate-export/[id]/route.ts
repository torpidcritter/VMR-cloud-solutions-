import { NextResponse } from "next/server";
import { ForbiddenError, assertAdmin } from "@/lib/auth/session";
import { exportCandidateData } from "@/lib/data/candidates";
import { logActivity } from "@/lib/data/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything held about one candidate as a JSON file, for a data access request. Super Admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await assertAdmin("candidates.export");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse(err.message, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const data = await exportCandidateData(id);
  if (!data) return new NextResponse("Not found.", { status: 404 });
  const name = String(data.profile.full_name ?? "candidate").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate";
  await logActivity(me.id, "export", "candidate", id, `Exported all data held about ${data.profile.full_name} (access request)`);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-data-${data.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
