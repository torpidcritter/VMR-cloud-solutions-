import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listPipeline, openingOptions, pipelineConversion, recruiterOptions } from "@/lib/data/applications";
import { APPLICATION_STATUS_LABELS, CANDIDATE_PRIORITIES, CANDIDATE_PRIORITY_LABELS } from "@/lib/data/constants";
import { Notice, PageHeader } from "@/components/admin/ui";
import { Board } from "./Board";

export const metadata: Metadata = { title: "Pipeline" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("applications.view");
  const sp = await searchParams;
  const f = { opening: one(sp.opening), assigned: one(sp.assigned) === "me" ? me.id : one(sp.assigned), q: one(sp.q) };
  const [{ cards, truncated }, conversion, openings, recruiters] = await Promise.all([listPipeline(f), pipelineConversion(f), openingOptions(), recruiterOptions()]);
  const filtered = Boolean(f.opening || f.assigned || f.q);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const max = Math.max(1, conversion.total);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={can(me.role, "applications.update") ? "Drag a card to another stage, or use its Move menu. Every move is saved and recorded." : "Your role can view the pipeline but not move cards."}
      />
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="opening" className="a-label">
            Job opening
          </label>
          <select id="opening" name="opening" defaultValue={f.opening ?? ""} className="a-field">
            <option value="">All openings</option>
            <option value="none">General applications (no opening)</option>
            {openings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.status !== "published" ? ` (${o.status})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label htmlFor="assigned" className="a-label">
            Recruiter
          </label>
          <select id="assigned" name="assigned" defaultValue={one(sp.assigned) ?? ""} className="a-field">
            <option value="">Everyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Name, email, #number" className="a-field" />
        </div>
        <div className="flex gap-2">
          {filtered && (
            <Link href="/admin/pipeline" className="a-btn">
              Clear
            </Link>
          )}
          <button className="a-btn a-btn-primary">Show</button>
        </div>
      </form>

      <section aria-labelledby="conv-h" className="card mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="conv-h" className="text-sm font-semibold">
            Conversion{filtered ? " for this view" : ""}
          </h2>
          <p className="text-xs text-muted">
            Of {conversion.total} applications · {conversion.rejected} rejected · {conversion.onHold} on hold. Counts include everyone who reached the stage, even if they moved on or were rejected later.
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {conversion.stages.map((s, i) => (
            <li key={s.stage} className="rounded-lg bg-surface px-3 py-2.5">
              <p className="truncate text-xs text-muted">{APPLICATION_STATUS_LABELS[s.stage]}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{s.count}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
              <p className="mt-1 text-[0.7rem] text-muted">{i === 0 ? "All applications" : `${pct(s.ofPrevious)} of previous · ${pct(s.ofTotal)} of all`}</p>
            </li>
          ))}
        </ol>
      </section>

      {truncated && <Notice tone="amber">Showing the 600 most recently moved applications. Choose a job opening or recruiter to see the rest.</Notice>}
      <Board cards={cards} canMove={can(me.role, "applications.update")} superAdmin={me.role === "super_admin"} />
      <p className="mt-2 text-xs text-muted">Priority labels come from the candidate profile ({CANDIDATE_PRIORITIES.filter((p) => p === "high" || p === "urgent").map((p) => CANDIDATE_PRIORITY_LABELS[p]).join(", ")} are shown on cards).</p>
    </>
  );
}
