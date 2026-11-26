"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import { BULK_LIMIT, bulkAssign, bulkFollowUp, bulkSetStatus, bulkTagCandidates } from "@/lib/data/bulk";
import { recruiterOptions } from "@/lib/data/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/data/constants";
import { logActivity } from "@/lib/data/activity";
import { notify } from "@/lib/data/notifications";
import { bulkSelection } from "../filters";
import { isIsoDate } from "@/lib/dates";

export type BulkResult = { ok: true; message: string; count: number } | { ok: false; error: string };

const NEEDS: Record<string, Permission> = { status: "applications.update", assign: "applications.update", tag: "candidates.edit", followup: "candidates.edit" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Applies one change to many applications: a stage, an owner, a tag or a
 * follow-up date. Permissions are checked here for the operation asked for,
 * and each operation is a single statement, so it applies to all or none.
 */
export async function bulkApplicationsAction(form: FormData): Promise<BulkResult> {
  const op = String(form.get("op") ?? "");
  const perm = NEEDS[op];
  if (!perm) return { ok: false, error: "Unknown bulk action." };
  let me;
  try {
    me = await assertAdmin(perm);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }
  const ids = await bulkSelection(form, can(me.role, "openings.viewClient"), me.id, BULK_LIMIT);
  if (!ids.length) return { ok: false, error: "Select at least one application." };
  const value = String(form.get("value") ?? "").trim();
  const of = `of ${plural(ids.length, "application")}`;

  if (op === "status") {
    if (!(APPLICATION_STATUSES as readonly string[]).includes(value)) return { ok: false, error: "Choose a stage." };
    const label = APPLICATION_STATUS_LABELS[value as ApplicationStatus];
    const n = await bulkSetStatus(ids, value as ApplicationStatus, me.id);
    if (n) await logActivity(me.id, "status", "application", null, `Moved ${plural(n, "application")} to ${label} (bulk)`);
    revalidatePath("/admin/applications");
    revalidatePath("/admin/pipeline");
    return { ok: true, count: n, message: n ? `Moved ${n} ${of} to ${label}.` : `All of them were already in ${label}.` };
  }

  if (op === "assign") {
    const to = value && value !== "none" ? value : null;
    let name = "nobody";
    if (to) {
      const r = (await recruiterOptions()).find((x) => x.id === to);
      if (!r) return { ok: false, error: "That person can't be given applications." };
      name = r.name;
    }
    const n = await bulkAssign(ids, to, me.id);
    if (n) {
      await logActivity(me.id, "assign", "application", null, to ? `Assigned ${plural(n, "application")} to ${name} (bulk)` : `Unassigned ${plural(n, "application")} (bulk)`);
      if (to) await notify([to], me.id, "assign", `${me.name} assigned you ${plural(n, "application")}`, "/admin/applications?assigned=me");
    }
    revalidatePath("/admin/applications");
    revalidatePath("/admin/pipeline");
    revalidatePath("/admin/my-work");
    return { ok: true, count: n, message: n ? (to ? `Assigned ${n} ${of} to ${name}.` : `Unassigned ${n} ${of}.`) : "Nothing changed: they were already assigned that way." };
  }

  if (op === "tag") {
    if (!value) return { ok: false, error: "Type a tag." };
    if (value.length > 40) return { ok: false, error: "Keep tags to 40 characters." };
    const n = await bulkTagCandidates(ids, value, me.id);
    if (n) await logActivity(me.id, "update", "candidate", null, `Tagged ${plural(n, "candidate")} "${value}" (bulk)`);
    revalidatePath("/admin/applications");
    revalidatePath("/admin/talent");
    return { ok: true, count: n, message: n ? `Tagged ${plural(n, "candidate")} "${value}".` : "Those candidates already have that tag (or the 20 tag limit)." };
  }

  // Follow-up date (or clear it with an empty value).
  const date = value || null;
  if (date && !isIsoDate(date)) return { ok: false, error: "Choose a valid date." };
  const n = await bulkFollowUp(ids, date, me.id);
  if (n) await logActivity(me.id, "update", "candidate", null, date ? `Set a follow-up on ${date} for ${plural(n, "candidate")} (bulk)` : `Cleared follow-ups for ${plural(n, "candidate")} (bulk)`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin/my-work");
  return { ok: true, count: n, message: n ? (date ? `Follow-up set for ${plural(n, "candidate")}.` : `Follow-up cleared for ${plural(n, "candidate")}.`) : "Nothing changed: they already had that follow-up." };
}
