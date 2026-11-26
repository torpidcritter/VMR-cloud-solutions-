import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, UserPlus, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listPools } from "@/lib/data/talent";
import { AddMatchingToPool } from "@/components/admin/talent-ui";
import { candidateFacets, listCandidates, type CandidateFilters } from "@/lib/data/candidates";
import { recruiterOptions } from "@/lib/data/applications";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, AVAILABILITY_OPTIONS, CANDIDATE_PRIORITIES, CANDIDATE_PRIORITY_LABELS } from "@/lib/data/constants";
import { ApplicationStatusBadge, EmptyState, PageHeader, Pagination, formatDate, withParams } from "@/components/admin/ui";
import { PriorityBadge, TagList } from "@/components/admin/candidate-ui";

export const metadata: Metadata = { title: "Candidates" };

const PAGE_SIZE = 25;
const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);
const KEYS = ["q", "skill", "resume", "pool", "tag", "priority", "owner", "followUp", "contacted", "minYears", "maxYears", "location", "availability", "stage", "specialisation"] as const;

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("applications.view");
  const sp = await searchParams;
  const search = Object.fromEntries(KEYS.map((k) => [k, one(sp[k])])) as Record<(typeof KEYS)[number], string | undefined>;
  const f: CandidateFilters = { ...search, owner: search.owner === "me" ? me.id : search.owner };
  const sort = one(sp.sort) ?? "updated";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ rows, total }, facets, recruiters, pools] = await Promise.all([listCandidates(f, { page, pageSize: PAGE_SIZE, sort }), candidateFacets(), recruiterOptions(), listPools()]);
  const canPool = can(me.role, "talent.manage");
  const filtered = Object.values(search).some(Boolean);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const current = { ...search, sort: sort === "updated" ? undefined : sort };

  const select = (name: string, label: string, options: { value: string; label: string }[], value?: string, any = "Any") => (
    <div>
      <label htmlFor={name} className="a-label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="a-field">
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
  const plain = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

  return (
    <>
      <PageHeader
        title="Candidates"
        description="The Talent Bank: one profile per person, built from every application and CV upload, with skills, resumes, pools and follow-ups."
        actions={
          can(me.role, "candidates.edit") ? (
            <Link href="/admin/candidates/new" className="a-btn a-btn-primary">
              <UserPlus aria-hidden className="size-4" /> Add candidate
            </Link>
          ) : undefined
        }
      />
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" defaultValue={search.q} placeholder="Name, email, phone, title, company, skill…" className="a-field" />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="skill" className="a-label">
            Skills (all of)
          </label>
          <input id="skill" name="skill" defaultValue={search.skill} placeholder="e.g. SAP FI, S/4HANA" list="skill-list" className="a-field" />
          <datalist id="skill-list">
            {facets.skills.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="resume" className="a-label">
            Resume contains
          </label>
          <input id="resume" name="resume" defaultValue={search.resume} placeholder='e.g. cutover "asset accounting"' className="a-field" />
        </div>
        {select("pool", "Talent pool", pools.map((p) => ({ value: p.id, label: p.name })), search.pool)}
        {select("tag", "Tag", plain(facets.tags), search.tag)}
        {select("priority", "Priority", CANDIDATE_PRIORITIES.map((p) => ({ value: p, label: CANDIDATE_PRIORITY_LABELS[p] })), search.priority)}
        {select("owner", "Owner", [{ value: "me", label: "Me" }, { value: "none", label: "No owner" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))], search.owner, "Anyone")}
        {select("contacted", "Last contacted", [{ value: "never", label: "Never" }, { value: "30", label: "Not in 30 days" }, { value: "90", label: "Not in 90 days" }, { value: "180", label: "Not in 6 months" }], search.contacted, "Any time")}
        {select("followUp", "Follow-up", [{ value: "due", label: "Due today or overdue" }, { value: "week", label: "Due within 7 days" }, { value: "any", label: "Has a follow-up date" }], search.followUp)}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="minYears" className="a-label">
              Min yrs
            </label>
            <input id="minYears" name="minYears" type="number" min={0} max={60} step={0.5} defaultValue={search.minYears} className="a-field" />
          </div>
          <div>
            <label htmlFor="maxYears" className="a-label">
              Max yrs
            </label>
            <input id="maxYears" name="maxYears" type="number" min={0} max={60} step={0.5} defaultValue={search.maxYears} className="a-field" />
          </div>
        </div>
        <div>
          <label htmlFor="location" className="a-label">
            Location
          </label>
          <input id="location" name="location" defaultValue={search.location} placeholder="City" className="a-field" />
        </div>
        {select("availability", "Availability", plain(AVAILABILITY_OPTIONS), search.availability)}
        {select("stage", "Has application in", APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] })), search.stage)}
        {select("specialisation", "Specialisation", plain(facets.specialisations), search.specialisation)}
        {select(
          "sort",
          "Sort by",
          [
            { value: "name", label: "Name" },
            { value: "priority", label: "Priority" },
            { value: "experience", label: "Experience" },
            { value: "followup", label: "Follow-up date" },
          ],
          sort === "updated" ? "" : sort,
          "Recently updated",
        )}
        <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-6">
          {filtered && (
            <Link href="/admin/candidates" className="a-btn">
              Clear
            </Link>
          )}
          <button className="a-btn a-btn-primary">Search</button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total.toLocaleString("en-IN")} candidate{total === 1 ? "" : "s"}
          {filtered ? " match" : ""}
        </p>
        {canPool && filtered && total > 0 && pools.length > 0 && <AddMatchingToPool pools={pools} filters={search} total={total} />}
      </div>
      <div className="mt-2">
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Current role</th>
                  <th>Skills and tags</th>
                  <th>Experience</th>
                  <th>Owner</th>
                  <th>Follow-up</th>
                  <th>Latest application</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-52">
                      <Link href={`/admin/candidates/${c.id}`} className="font-medium hover:text-brand-600">
                        {c.full_name}
                      </Link>
                      {c.has_resume && <Paperclip aria-label="Resume on file" className="ml-1.5 inline size-3.5 text-muted" />}
                      {c.priority !== "normal" && (
                        <span className="ml-2">
                          <PriorityBadge priority={c.priority} />
                        </span>
                      )}
                      <div className="text-xs text-muted">{c.email}</div>
                      <div className="text-xs text-muted">{[c.phone, c.location].filter(Boolean).join(" · ")}</div>
                      <div className="text-xs text-muted">{c.last_contacted_at ? `Contacted ${formatDate(c.last_contacted_at)}` : "Not contacted yet"}</div>
                    </td>
                    <td className="min-w-40">
                      {c.current_title || c.specialisation || <span className="text-muted">—</span>}
                      {c.current_company && <div className="text-xs text-muted">{c.current_company}</div>}
                    </td>
                    <td className="min-w-48 max-w-72">
                      <TagList items={c.skills.slice(0, 5)} more={c.skills.length - 5} />
                      {c.tags.length > 0 && (
                        <div className="mt-1">
                          <TagList items={c.tags} tone="violet" />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {c.experience_years != null ? `${c.experience_years} yrs` : c.experience || <span className="text-muted">—</span>}
                      {c.availability && <div className="text-xs text-muted">{c.availability}</div>}
                    </td>
                    <td className="whitespace-nowrap">{c.owner_name ?? <span className="text-muted">—</span>}</td>
                    <td className="whitespace-nowrap">
                      {c.follow_up_on ? (
                        <span className={c.follow_up_on <= today ? "font-semibold text-accent-600" : ""}>{formatDate(`${c.follow_up_on}T00:00:00+05:30`)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="min-w-44">
                      {c.latest_application_id ? (
                        <Link href={`/admin/applications/${c.latest_application_id}`} className="hover:text-brand-600">
                          <span className="block">{c.latest_position}</span>
                          {c.latest_status && <ApplicationStatusBadge status={c.latest_status} />}
                          {c.applications > 1 && <span className="ml-1.5 text-xs text-muted">+{c.applications - 1} more</span>}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={filtered ? "No candidates match" : "No candidates yet"} icon={Users}>
            {filtered ? "Try fewer filters, or search one skill at a time." : "Candidates are added automatically when they apply or upload a CV."}
          </EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => withParams("/admin/candidates", current, { page: String(p) })} />
      </div>
    </>
  );
}
