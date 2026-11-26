import { NextResponse } from "next/server";
import { assertAdmin, ForbiddenError } from "@/lib/auth/session";
import { getInterview, interviewIcs } from "@/lib/data/interviews";

export const runtime = "nodejs";

/** Calendar file for one interview, for signed-in admins only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdmin("applications.view");
  } catch (err) {
    if (err instanceof ForbiddenError) return new NextResponse("Not allowed", { status: 403 });
    throw err;
  }
  const i = await getInterview((await params).id);
  if (!i) return new NextResponse("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  const name = `interview-${i.candidate_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "candidate"}.ics`;
  return new NextResponse(interviewIcs(i, origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
