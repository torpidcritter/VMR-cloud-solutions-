import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Clock, MapPin } from "lucide-react";
import type { PublicOpening } from "@/lib/data/openings";

/** A job card on the Careers page. */
export function JobCard({ job, index = 0 }: { job: PublicOpening; index?: number }) {
  return (
    <li data-reveal style={{ ["--reveal-delay" as string]: `${(index % 3) * 60}ms` }}>
      <Link href={`/careers/${job.slug}`} className="card card-hover group flex h-full flex-col p-6">
        <span className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {job.sap_module && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-600">{job.sap_module}</span>}
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-soft">{job.employment_type}</span>
        </span>
        <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:text-brand-700">{job.title}</h3>
        <p className="mt-1 text-sm text-muted">{job.public_client_label}</p>
        {job.summary && <p className="mt-3 line-clamp-3 text-[0.95rem] leading-relaxed text-ink-soft">{job.summary}</p>}
        <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-5 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4" /> {job.location} · {job.work_mode}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness aria-hidden className="size-4" /> {job.experience}
          </span>
        </span>
        <span className="link-arrow mt-4">
          View and apply <ArrowRight aria-hidden className="size-4" />
        </span>
      </Link>
    </li>
  );
}

/** Renders the plain-text description: blank lines split paragraphs, "- " lines become bullets. */
export function JobDescription({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="prose-legal">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
        if (bullets.length && bullets.length === lines.length) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-•*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        // A short line ending in ":" reads as a sub-heading.
        if (lines.length > 1 && lines[0].length < 80 && lines[0].endsWith(":") && lines.slice(1).every((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <div key={i}>
              <h3>{lines[0].replace(/:$/, "")}</h3>
              <ul>
                {lines.slice(1).map((l, j) => (
                  <li key={j}>{l.replace(/^\s*[-•*]\s+/, "")}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export function JobMeta({ job }: { job: PublicOpening }) {
  const rows: [string, string][] = [
    ["Location", `${job.location} (${job.work_mode})`],
    ["Employment type", job.employment_type],
    ["Experience", job.experience],
    ...(job.salary_range ? ([["Salary", job.salary_range]] as [string, string][]) : []),
    ...(job.closing_date ? ([["Apply by", new Date(`${job.closing_date}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })]] as [string, string][]) : []),
  ];
  return (
    <dl className="grid gap-4">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{k}</dt>
          <dd className="mt-1 font-medium text-ink">{v}</dd>
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Clock aria-hidden className="size-3.5" /> Posted {new Date(job.published_at ?? job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
      </p>
    </dl>
  );
}
