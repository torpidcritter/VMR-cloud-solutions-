"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/session";
import { CV_MAX_BYTES, CV_MAX_LABEL, CV_MIME, fileExtension } from "@/lib/cv";
import { inspectCvFile } from "@/lib/file-check";
import { deleteStoredFile, isStorageConfigured, readStoredFile, storeCandidateFile } from "@/lib/cv-storage";
import { extractResumeText } from "@/lib/resume-text";
import { candidateIds, getCandidate, type CandidateFilters } from "@/lib/data/candidates";
import {
  addCandidateFile,
  addToPool,
  applicationsWithoutText,
  candidateIdByEmail,
  createCandidate,
  deleteCandidateFile,
  deletePool,
  parseNewCandidate,
  parsePool,
  removeFromPool,
  saveApplicationText,
  savePool,
} from "@/lib/data/talent";
import { addCandidateToOpening } from "@/lib/data/matching";
import { getOpening } from "@/lib/data/openings";
import { logActivity } from "@/lib/data/activity";
import type { ActionState } from "@/components/admin/forms";

const s = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fields = (form: FormData) => Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

type Checked = { ok: true; buffer: Buffer; ext: "pdf" | "doc" | "docx"; name: string } | { ok: false; error: string };

/** The same checks a website upload gets: size, extension, and the file's own bytes. */
async function checkUpload(file: FormDataEntryValue | null): Promise<Checked | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > CV_MAX_BYTES) return { ok: false, error: `The file is larger than ${CV_MAX_LABEL}.` };
  const ext = fileExtension(file.name);
  if (!ext) return { ok: false, error: "Upload a PDF, DOC or DOCX file." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const check = inspectCvFile(buffer, ext);
  if (!check.ok) return { ok: false, error: check.reason };
  return { ok: true, buffer, ext, name: file.name.replace(/[\\/\u0000-\u001f]/g, "").slice(0, 180) || `resume.${ext}` };
}

/** Stores the file, reads its text and records it. The stored file is removed again if recording fails. */
async function storeForCandidate(candidateId: string, f: Extract<Checked, { ok: true }>, userId: string) {
  const stored = await storeCandidateFile({ file: f.buffer, ext: f.ext, contentType: CV_MIME[f.ext] });
  const text = extractResumeText(f.buffer, f.ext);
  try {
    const id = await addCandidateFile(candidateId, { path: stored.path, name: f.name, size: f.buffer.length, type: f.ext, ...text }, userId);
    if (!id) throw new Error("candidate missing");
    return { id, text: text.status };
  } catch (err) {
    await deleteStoredFile(stored.path).catch(() => {});
    throw err;
  }
}

const TEXT_NOTE = { ok: "Its text can now be searched.", empty: "No text could be read from it (it may be a scanned image), so it won't show up in resume search.", failed: "Its text couldn't be read, so it won't show up in resume search." };

export async function uploadCandidateFileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("candidates.edit");
  const candidateId = s(form.get("candidateId"), 40);
  const c = isUuid(candidateId) ? await getCandidate(candidateId) : null;
  if (!c) return { error: "This candidate no longer exists." };
  if (!isStorageConfigured()) return { error: "File storage isn't connected, so resumes can't be uploaded yet." };
  const f = await checkUpload(form.get("file"));
  if (!f) return { errors: { file: "Choose a resume to upload." }, error: "Please fix the highlighted fields." };
  if (!f.ok) return { errors: { file: f.error }, error: "Please fix the highlighted fields." };
  const saved = await storeForCandidate(c.id, f, me.id);
  await logActivity(me.id, "create", "candidate", c.id, `Uploaded a resume for ${c.full_name}`);
  revalidatePath(`/admin/candidates/${c.id}`);
  return { ok: true, message: `Resume uploaded. ${TEXT_NOTE[saved.text]}` };
}

export async function deleteCandidateFileAction(form: FormData) {
  const me = await assertAdmin("candidates.edit");
  const row = await deleteCandidateFile(s(form.get("id"), 40), me.id);
  if (!row) return;
  await deleteStoredFile(row.file_path).catch((err) => console.error("[admin] stored file not removed", err instanceof Error ? err.message : err));
  await logActivity(me.id, "delete", "candidate", row.candidate_id, `Deleted the resume ${row.file_name}`);
  revalidatePath(`/admin/candidates/${row.candidate_id}`);
}

export async function createCandidateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("candidates.edit");
  const { data, errors } = parseNewCandidate(fields(form));
  const f = await checkUpload(form.get("file"));
  if (f && !f.ok) errors.file = f.error;
  if (f?.ok && !isStorageConfigured()) errors.file = "File storage isn't connected, so the resume can't be stored. Add the candidate without it for now.";
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const existing = await candidateIdByEmail(data.email);
  if (existing) return { errors: { email: "This email is already in the Talent Bank." }, error: "This candidate is already in the Talent Bank.", data: { existing } };
  const id = await createCandidate(data, me.id);
  if (!id) return { errors: { email: "This email is already in the Talent Bank." }, error: "This candidate is already in the Talent Bank." };
  await logActivity(me.id, "create", "candidate", id, `Added ${data.fullName} to the Talent Bank`);
  if (f?.ok) {
    try {
      await storeForCandidate(id, f, me.id);
    } catch (err) {
      console.error("[admin] resume for new candidate not stored", err instanceof Error ? err.message : err);
      redirect(`/admin/candidates/${id}?resume=failed`);
    }
  }
  revalidatePath("/admin/candidates");
  redirect(`/admin/candidates/${id}?created=1`);
}

/* ---------------------------- Talent pools ---------------------------- */

export async function savePoolAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("talent.manage");
  const id = s(form.get("id"), 40) || null;
  const { data, errors } = parsePool(fields(form));
  if (Object.keys(errors).length) return { errors, error: "Please fix the highlighted fields." };
  const saved = await savePool(id, data, me.id);
  if (saved === "duplicate") return { errors: { name: "A pool with this name already exists." }, error: "Please fix the highlighted fields." };
  if (!saved) return { error: "This pool no longer exists." };
  await logActivity(me.id, id ? "update" : "create", "pool", saved, `${id ? "Updated" : "Created"} the talent pool ${data.name}`);
  revalidatePath("/admin/talent-pools");
  if (!id) redirect(`/admin/talent-pools/${saved}`);
  revalidatePath(`/admin/talent-pools/${saved}`);
  return { ok: true, message: "Pool saved." };
}

export async function deletePoolAction(form: FormData) {
  const me = await assertAdmin("talent.manage");
  const id = s(form.get("id"), 40);
  const name = await deletePool(id);
  if (name) await logActivity(me.id, "delete", "pool", id, `Deleted the talent pool ${name} (candidates are kept)`);
  revalidatePath("/admin/talent-pools");
  redirect("/admin/talent-pools?deleted=1");
}

export async function addToPoolAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("talent.manage");
  const poolId = s(form.get("poolId"), 40);
  const candidateId = s(form.get("candidateId"), 40);
  if (!isUuid(poolId)) return { error: "Choose a pool." };
  const n = await addToPool(poolId, [candidateId], me.id);
  revalidatePath(`/admin/candidates/${candidateId}`);
  revalidatePath(`/admin/talent-pools/${poolId}`);
  return n ? { ok: true, message: "Added to the pool." } : { error: "Already in that pool." };
}

export async function removeFromPoolAction(form: FormData) {
  const me = await assertAdmin("talent.manage");
  const poolId = s(form.get("poolId"), 40);
  const candidateId = s(form.get("candidateId"), 40);
  await removeFromPool(poolId, candidateId, me.id);
  revalidatePath(`/admin/candidates/${candidateId}`);
  revalidatePath(`/admin/talent-pools/${poolId}`);
}

/** Every candidate matching the current search goes into a pool (up to 2,000). */
export async function addMatchingToPoolAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("talent.manage");
  const poolId = s(form.get("poolId"), 40);
  if (!isUuid(poolId)) return { error: "Choose a pool." };
  const raw = fields(form);
  const f: CandidateFilters = Object.fromEntries(Object.entries(raw).filter(([k]) => k.startsWith("f_")).map(([k, v]) => [k.slice(2), String(v).slice(0, 120)]));
  if (f.owner === "me") f.owner = me.id;
  const ids = await candidateIds(f, 2000);
  const n = await addToPool(poolId, ids, me.id);
  await logActivity(me.id, "update", "pool", poolId, `Added ${n} candidate${n === 1 ? "" : "s"} from a search to a talent pool`);
  revalidatePath(`/admin/talent-pools/${poolId}`);
  revalidatePath("/admin/talent-pools");
  return { ok: true, message: n ? `Added ${n} candidate${n === 1 ? "" : "s"} to the pool${ids.length > n ? ` (${ids.length - n} were already in it)` : ""}.` : "They are all in that pool already." };
}

/* ------------------------------ Matching ------------------------------ */

export async function putForwardAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertAdmin("applications.update");
  const candidateId = s(form.get("candidateId"), 40);
  const openingId = s(form.get("openingId"), 40);
  const [c, o] = await Promise.all([isUuid(candidateId) ? getCandidate(candidateId) : null, getOpening(openingId)]);
  if (!c || !o) return { error: "This candidate or opening no longer exists." };
  if (o.status === "closed") return { error: "This opening is closed." };
  const res = await addCandidateToOpening(c.id, o.id, me.id);
  if (!res) return { error: "This candidate or opening no longer exists." };
  if (res.created) await logActivity(me.id, "create", "application", res.id, `Put ${c.full_name} forward for ${o.title}`);
  revalidatePath(`/admin/openings/${o.id}`);
  revalidatePath(`/admin/candidates/${c.id}`);
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/applications");
  return { ok: true, message: res.created ? `${c.full_name} added to the ${o.title} pipeline.` : `${c.full_name} is already in this pipeline.`, data: { applicationId: res.id } };
}

/* ------------------- Text for resumes sent before ------------------- */

export async function readResumeTextAction(): Promise<ActionState> {
  const me = await assertAdmin("settings.manage");
  if (!isStorageConfigured()) return { error: "File storage isn't connected." };
  const batch = await applicationsWithoutText(20);
  let read = 0;
  for (const a of batch) {
    const ext = fileExtension(a.resume_path) ?? "pdf";
    try {
      const file = await readStoredFile(a.resume_path);
      if (!file) {
        await saveApplicationText(a.id, "failed", "");
        continue;
      }
      const buf = Buffer.isBuffer(file.body) ? file.body : Buffer.from(await new Response(file.body as ReadableStream).arrayBuffer());
      const t = extractResumeText(buf, ext);
      await saveApplicationText(a.id, t.status, t.text);
      if (t.status === "ok") read++;
    } catch (err) {
      console.error("[admin] resume text failed", a.id, err instanceof Error ? err.message : err);
      await saveApplicationText(a.id, "failed", "");
    }
  }
  if (batch.length) await logActivity(me.id, "update", "settings", null, `Read text from ${batch.length} stored resume${batch.length === 1 ? "" : "s"}`);
  revalidatePath("/admin/settings");
  return { ok: true, message: batch.length ? `Checked ${batch.length} resume${batch.length === 1 ? "" : "s"}; text found in ${read}.` : "Every stored resume has been checked." };
}
