import Link from "next/link";
import { BadgeCheck, LockKeyhole, Mail, Route, UserSearch } from "lucide-react";
import { CvUploadForm } from "@/components/forms/CvUploadForm";
import { PageHero } from "@/components/sections/shared";
import { Section } from "@/components/ui/Section";
import { recruitmentPositioning } from "@/content/recruitment";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Upload Your CV",
  description:
    "SAP consultants, developers, architects and project managers: upload your CV to be considered for contract and permanent SAP roles across the UK and Europe.",
  path: "/upload-cv",
});

const steps = [
  { icon: UserSearch, title: "We review your profile", text: "A recruiter who knows SAP reads your CV and notes your modules, projects and preferences." },
  { icon: Route, title: "We match you to roles", text: "We consider you for contract and permanent opportunities that fit your experience." },
  { icon: Mail, title: "We get in touch", text: "When a role matches, we contact you to discuss it before anything is shared with an employer." },
];

export default function UploadCvPage() {
  return (
    <>
      <PageHero
        eyebrow="For SAP professionals"
        title="Upload Your CV."
        text={`Share your profile once and be considered for contract and permanent SAP opportunities with end customers and SAP service integrators across the ${recruitmentPositioning.markets}.`}
        crumbs={[{ label: "Home", href: "/" }, { label: "Upload Your CV" }]}
      >
        <a href="#cv-form" className="btn btn-primary">
          Start your upload
        </a>
      </PageHero>

      <Section tone="surface" labelledBy="cv-form-title" id="cv-form" className="!pt-14 md:!pt-20">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-8">
            <div className="card p-6 shadow-[var(--shadow-card)] md:p-10">
              <h2 id="cv-form-title" className="text-2xl font-bold tracking-tight">
                Your details
              </h2>
              <p className="mt-2 text-[0.95rem] text-muted">
                All fields are required. It takes about two minutes.
              </p>
              <div className="mt-8">
                <CvUploadForm />
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:col-span-4" aria-label="About your submission">
            <div className="card p-6 md:p-7">
              <h2 className="text-base font-semibold">What happens next</h2>
              <ol className="mt-5 space-y-5">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-brand-200 bg-card text-brand-600">
                      <s.icon aria-hidden className="size-[1.1rem]" strokeWidth={1.75} />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-muted">Step {i + 1}</span>
                      <span className="block font-semibold text-ink">{s.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="card p-6 md:p-7">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <LockKeyhole aria-hidden className="size-4 text-brand-600" /> Your data is protected
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-soft">
                {[
                  "CVs are stored in private storage, never on the public website.",
                  "Only our recruitment team can access your details.",
                  "We never send your CV to an employer without speaking to you first.",
                  "You can ask us to delete your data at any time.",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">
                Read our{" "}
                <Link href="/privacy-policy#candidates" className="font-semibold text-brand-700 underline underline-offset-2">
                  candidate privacy notice
                </Link>
                .
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-card p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Prefer email?</p>
              <a href={`mailto:${site.email.hr}`} className="mt-3 flex items-center gap-3 font-semibold text-brand-700">
                <Mail aria-hidden className="size-4" />
                <span className="u-link">{site.email.hr}</span>
              </a>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
