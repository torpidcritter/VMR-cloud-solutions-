import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CareerForm } from "@/components/forms/CareerForm";
import { PageHero } from "@/components/sections/shared";
import { JobDescription, JobMeta } from "@/components/sections/jobs";
import { getPublicOpening } from "@/lib/data/openings";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/content/site";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getPublicOpening((await params).slug);
  if (!job) return { title: "Job not found", robots: { index: false } };
  return pageMetadata({
    title: `${job.title} – ${job.location}`,
    description: (job.summary || job.description).slice(0, 155),
    path: `/careers/${job.slug}`,
  });
}

const EMPLOYMENT: Record<string, string> = { Permanent: "FULL_TIME", Contract: "CONTRACTOR", "Contract-to-hire": "CONTRACTOR", Internship: "INTERN" };

export default async function JobPage({ params }: Props) {
  const job = await getPublicOpening((await params).slug);
  if (!job) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.replace(/\n/g, "<br>"),
    datePosted: (job.published_at ?? job.created_at).slice(0, 10),
    ...(job.closing_date ? { validThrough: `${job.closing_date}T23:59:59+05:30` } : {}),
    employmentType: EMPLOYMENT[job.employment_type] ?? "OTHER",
    hiringOrganization: { "@type": "Organization", name: site.name, sameAs: site.url, logo: `${site.url}/brand/vmr-cloud-logo.png` },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" } },
    ...(job.work_mode === "Remote" ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "India" } } : {}),
    ...(job.skills.length ? { skills: job.skills.join(", ") } : {}),
    directApply: true,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero
        eyebrow={job.sap_module ? `${job.sap_module} · ${job.employment_type}` : job.employment_type}
        title={job.title}
        text={`${job.public_client_label} · ${job.location} · ${job.work_mode}`}
        crumbs={[{ label: "Home", href: "/" }, { label: "Careers", href: "/careers" }, { label: job.title }]}
      >
        <a href="#apply" className="btn btn-primary">
          Apply for this role
        </a>
      </PageHero>

      <section className="section-y">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <article className="lg:col-span-8">
            {job.summary && <p className="lead mb-8">{job.summary}</p>}
            <JobDescription text={job.description} />
            {job.skills.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold">Key skills</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((s) => (
                    <li key={s} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
          <aside className="lg:col-span-4">
            <div className="card sticky top-[calc(var(--header-h)+1.5rem)] p-6">
              <JobMeta job={job} />
              <a href="#apply" className="btn btn-primary mt-6 w-full">
                Apply now
              </a>
              <Link href="/careers#openings" className="mt-3 block text-center text-sm text-muted hover:text-brand-600">
                See all openings
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="apply" aria-labelledby="apply-h" className="section-y border-t border-line bg-surface">
        <div className="container-x max-w-4xl">
          <p className="eyebrow">Apply</p>
          <h2 id="apply-h" className="t-2 mt-3">
            Apply for {job.title}
          </h2>
          <p className="mt-3 text-ink-soft">Send your details and resume. Our recruitment team reviews every application.</p>
          <div className="card mt-8 p-6 shadow-[var(--shadow-card)] md:p-10">
            <CareerForm opening={{ id: job.id, title: job.title }} />
          </div>
        </div>
      </section>
    </>
  );
}

/** Pages are built on first visit and refreshed every 5 minutes (or when edited in the admin). */
export function generateStaticParams() {
  return [];
}
