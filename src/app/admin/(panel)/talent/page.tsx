import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listTalent, talentFacets } from "@/lib/data/applications";
import { ApplicationStatusBadge, EmptyState, PageHeader, Pagination, formatDate, withParams } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Talent Bank" };

const PAGE_SIZE = 25;
const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : undefined);

export default async function TalentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("applications.view");
  const sp = await searchParams;
  const f = { q: one(sp.q), specialisation: one(sp.specialisation), experience: one(sp.experience), employmentType: one(sp.employmentType), location: one(sp.location) };
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ rows, total }, facets] = await Promise.all([listTalent(f, { page, pageSize: PAGE_SIZE }), talentFacets()]);
  const filtered = Object.values(f).some(Boolean);
  const select = (name: keyof typeof f, label: string, options: string[]) => (
    <div>
      <label htmlFor={name} className="a-label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={f[name] ?? ""} className="a-field">
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader title="Talent Bank" description="One profile per candidate (matched by email), built from every application and CV upload." />
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Name, email, phone or skill" className="a-field" />
        </div>
        {select("specialisation", "Specialisation", facets.specialisations)}
        {select("experience", "Experience", facets.experiences)}
        {select("employmentType", "Employment type", facets.employmentTypes)}
        <div>
          <label htmlFor="location" className="a-label">
            Location
          </label>
          <input id="location" name="location" defaultValue={f.location} placeholder="City" className="a-field" />
        </div>
        <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-6">
          {filtered && (
            <Link href="/admin/talent" className="a-btn">
              Clear
            </Link>
          )}
          <button className="a-btn a-btn-primary">Search</button>
        </div>
      </form>

      <p className="mt-5 text-sm text-muted">{total.toLocaleString("en-IN")} candidate{total === 1 ? "" : "s"}</p>
      <div className="mt-2">
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Specialisation</th>
                  <th>Experience</th>
                  <th>Location</th>
                  <th>Latest application</th>
                  <th className="text-right">Applications</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-48">
                      <Link href={`/admin/applications?q=${encodeURIComponent(c.email)}`} className="font-medium hover:text-brand-600">
                        {c.full_name}
                      </Link>
                      {c.has_resume && <Paperclip aria-label="Resume on file" className="ml-1.5 inline size-3.5 text-muted" />}
                      <div className="text-xs text-muted">{c.email}</div>
                      <div className="text-xs text-muted">{c.phone}</div>
                    </td>
                    <td>{c.specialisation || <span className="text-muted">—</span>}</td>
                    <td className="whitespace-nowrap">
                      {c.experience || <span className="text-muted">—</span>}
                      {c.employment_type && <div className="text-xs text-muted">{c.employment_type}</div>}
                    </td>
                    <td>
                      {c.location || <span className="text-muted">—</span>}
                      {c.preferred_location && <div className="text-xs text-muted">Prefers {c.preferred_location}</div>}
                    </td>
                    <td className="min-w-40">
                      {c.latest_application_id ? (
                        <Link href={`/admin/applications/${c.latest_application_id}`} className="hover:text-brand-600">
                          <span className="block">{c.latest_position}</span>
                          {c.latest_status && <ApplicationStatusBadge status={c.latest_status} />}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right tabular-nums">{c.applications}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={filtered ? "No candidates match" : "The talent bank is empty"} icon={Users}>
            {filtered ? "Try fewer filters." : "Candidates are added automatically when they apply or upload a CV."}
          </EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => withParams("/admin/talent", f, { page: String(p) })} />
      </div>
    </>
  );
}
