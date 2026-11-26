import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { matchCandidatesForOpening } from "@/lib/data/matching";
import { EmptyState, Notice, OpeningStatusBadge, PageHeader } from "@/components/admin/ui";
import { PriorityBadge } from "@/components/admin/candidate-ui";
import { MatchReasons, PutForwardButton, ScoreRing } from "@/components/admin/talent-ui";

export const metadata: Metadata = { title: "Matching candidates" };

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin("applications.view");
  if (!can(me.role, "openings.view")) notFound();
  const { id } = await params;
  const result = await matchCandidatesForOpening(id, 30);
  if (!result) notFound();
  const { opening: o, terms, matches, applied, considered } = result;
  const canForward = can(me.role, "applications.update") && o.status !== "closed";

  return (
    <>
      <Link href={`/admin/openings/${o.id}`} className="text-sm text-muted hover:text-brand-600">
        ← {o.title}
      </Link>
      <PageHeader
        title="Matching candidates"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OpeningStatusBadge status={o.status} /> {o.title}
            {o.location ? ` · ${o.location}` : ""}
          </span>
        }
      />
      <div className="card mb-5 p-4 text-sm text-ink-soft">
        <p>
          Scored by fixed rules: skills on the profile or in a resume (50), SAP module (15), experience against the minimum (20), location (10) and availability (5). Rules the opening
          gives nothing to compare are left out.
        </p>
        <p className="mt-2 text-muted">
          Looking for: {terms.length ? terms.join(", ") : "nothing yet"}
          {o.min_experience_years != null ? ` · ${o.min_experience_years}+ years` : ""}. {considered} profile{considered === 1 ? "" : "s"} mention at least one of these.
          {applied > 0 && (
            <>
              {" "}
              <Link href={`/admin/applications?opening=${o.id}`} className="font-medium text-brand-600 hover:underline">
                {applied} already applied
              </Link>{" "}
              and {applied === 1 ? "is" : "are"} not listed.
            </>
          )}
        </p>
      </div>
      {!terms.length && <Notice tone="amber">Add skills or an SAP module to this opening so candidates can be matched to it.</Notice>}

      {matches.length ? (
        <ol className="grid gap-3">
          {matches.map((m, i) => (
            <li key={m.id} className="card flex flex-wrap gap-4 p-4 sm:flex-nowrap">
              <ScoreRing score={m.match.score} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tabular-nums text-muted">#{i + 1}</span>
                  <Link href={`/admin/candidates/${m.id}`} className="font-semibold hover:text-brand-600">
                    {m.full_name}
                  </Link>
                  {m.priority !== "normal" && <PriorityBadge priority={m.priority} />}
                </p>
                <p className="text-xs text-muted">{[m.current_title || m.specialisation, m.location].filter(Boolean).join(" · ") || "No role or location recorded"}</p>
                <MatchReasons match={m.match} />
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {m.match.parts.map((p) => (
                    <span key={p.rule} className="tabular-nums">
                      {p.rule} {Math.round(p.got)}/{p.of}
                    </span>
                  ))}
                </p>
              </div>
              {canForward && (
                <div className="flex shrink-0 items-start">
                  <PutForwardButton candidateId={m.id} openingId={o.id} />
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        terms.length > 0 && (
          <EmptyState title={considered > applied ? "No strong matches" : considered ? "Everyone who matches is already in the pipeline" : "No matching candidates yet"} icon={Sparkles}>
            {considered
              ? "New applicants, and resumes your team uploads, are matched automatically."
              : "No one in the Talent Bank has these skills on their profile or in a resume. Candidates who apply, and resumes your team uploads, are matched automatically."}
          </EmptyState>
        )
      )}
    </>
  );
}
