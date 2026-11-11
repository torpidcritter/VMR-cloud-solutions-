import { ArrowRight, BookOpen, Code2, GraduationCap, Mail, Users } from "lucide-react";
import { CareerForm } from "@/components/forms/CareerForm";
import { PageHero } from "@/components/sections/shared";
import { Section, SectionHeading } from "@/components/ui/Section";
import { careerAreas, internshipAreas } from "@/content/company";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Careers",
  description:
    "Build your career with VMR Cloud Solutions in Bengaluru. Explore opportunities in SAP consulting, Java and Python development, software engineering, QA and internships.",
  path: "/careers",
});

const reasons = [
  { icon: BookOpen, title: "Continuous learning", text: "Exposure to evolving enterprise technologies and modern engineering practices." },
  { icon: Users, title: "Collaborative teams", text: "Work alongside consultants and engineers who share knowledge openly." },
  { icon: Code2, title: "Real projects", text: "Contribute to technology-driven projects across SAP, Java and Python." },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="Careers at VMR"
        title="Build Your Future With VMR Cloud Solutions."
        text="Grow with technology. Build with purpose. Whether you are an experienced professional or an aspiring technology enthusiast, explore opportunities to develop your career in IT and consulting."
        crumbs={[{ label: "Home", href: "/" }, { label: "Careers" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="#apply" className="btn btn-primary">
            Submit Your Resume <ArrowRight aria-hidden className="size-4" />
          </a>
          <a href="#opportunities" className="btn btn-secondary">
            Explore Opportunities
          </a>
        </div>
      </PageHero>

      <Section labelledBy="why-join">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="why-join"
              eyebrow="Life at VMR"
              title="Grow With Technology. Build With Purpose."
              text="At VMR Cloud Solutions, we recognize that technology is driven by people, ideas and continuous learning. We aim to create an environment where professionals can develop their technical capabilities, collaborate on projects and grow through exposure to evolving technologies."
            />
          </div>
          <ul className="grid gap-4 lg:col-span-7">
            {reasons.map((r, i) => (
              <li key={r.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="card flex gap-5 p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <r.icon aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                <span>
                  <h3 className="text-lg font-semibold tracking-tight">{r.title}</h3>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">{r.text}</p>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="surface" labelledBy="opportunities" id="opportunities">
        <div className="container-x">
          <SectionHeading
            id="opportunities-h"
            eyebrow="Career areas"
            title="Where you could contribute."
            text="We welcome applications in the following areas. Send us your resume and our HR team will be in touch when a suitable role opens."
          />
          <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {careerAreas.map((a, i) => (
              <li key={a} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 5) * 50}ms` }} className="card flex items-center justify-between gap-3 px-5 py-4">
                <span className="text-[0.95rem] font-semibold text-ink">{a}</span>
                <span className="font-display text-xs font-bold text-line-strong">{String(i + 1).padStart(2, "0")}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="internships">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-8 text-white md:p-12 lg:p-16">
            <div aria-hidden className="absolute inset-0 bg-dots-dark" />
            <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5" data-reveal>
                <GraduationCap aria-hidden className="size-8 text-sky-brand" strokeWidth={1.5} />
                <p className="eyebrow mt-6">Internships</p>
                <h2 id="internships" className="t-2 mt-4 !text-white">
                  Start your career in software development.
                </h2>
                <p className="mt-5 leading-relaxed text-slate-300">
                  VMR Cloud Solutions offers internship opportunities in software development. Interns work alongside our engineers and gain hands-on experience across the software lifecycle.
                </p>
                <a href="#apply" className="btn btn-light mt-8">
                  Apply for an internship <ArrowRight aria-hidden className="size-4" />
                </a>
              </div>
              <div className="lg:col-span-7" data-reveal style={{ ["--reveal-delay" as string]: "100ms" }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">What interns work on</p>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {internshipAreas.map((a) => (
                    <li key={a} className="flex items-center gap-3 rounded-xl border border-white/10 bg-card/[0.04] px-4 py-3 text-[0.95rem] text-slate-200">
                      <span className="size-1.5 shrink-0 rounded-full bg-sky-brand" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="surface" labelledBy="apply-h" id="apply">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHeading id="apply-h" eyebrow="Apply" title="Submit your resume." text="Share your details and resume. We review every application." />
            <div data-reveal className="mt-8 rounded-2xl border border-line bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">HR enquiries</p>
              <a href={`mailto:${site.email.hr}`} className="mt-3 flex items-center gap-3 font-semibold text-brand-700">
                <Mail aria-hidden className="size-4" />
                <span className="u-link">{site.email.hr}</span>
              </a>
            </div>
          </div>
          <div data-reveal className="card p-6 shadow-[var(--shadow-card)] md:p-10 lg:col-span-8">
            <CareerForm />
          </div>
        </div>
      </Section>
    </>
  );
}
