import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, Globe2 } from "lucide-react";
import { HeroVisual } from "@/components/sections/HeroVisual";
import { AudiencePaths, RecruitmentServiceCards, SapAreasGrid } from "@/components/sections/recruitment";
import {
  CertificationsSection,
  ClientsSection,
  CtaBand,
  ServiceCard,
  WhyGrid,
} from "@/components/sections/shared";
import { CountUp } from "@/components/ui/CountUp";
import { genericIcons } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/Section";
import { industries, pillars, stats } from "@/content/company";
import { recruitmentPositioning } from "@/content/recruitment";
import { services } from "@/content/services";
import { site } from "@/content/site";

export default function HomePage() {
  return (
    <>
      {/* 01 — Hero */}
      <section className="relative -mt-[var(--header-h)] overflow-hidden bg-gradient-to-b from-brand-50/80 via-page to-page pt-[var(--header-h)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial" />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 size-[34rem] rounded-full bg-sky-brand/10 blur-3xl" />
        <div className="container-x relative grid items-center gap-12 pb-20 pt-10 md:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-20">
          <div className="lg:col-span-6 xl:col-span-6">
            <p className="eyebrow text-[0.7rem] sm:text-xs">{recruitmentPositioning.eyebrow}</p>
            <h1 className="t-display mt-6">
              SAP Recruitment &amp; <span className="bg-gradient-to-r from-brand-600 to-[#0aa6e0] bg-clip-text text-transparent">SAP Staffing Solutions.</span>
            </h1>
            <p className="lead mt-6 max-w-xl">{recruitmentPositioning.summary}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact?service=contract-sap-recruitment" className="btn btn-primary">
                Find SAP Talent <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/upload-cv" className="btn btn-secondary">
                Upload Your CV
              </Link>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
              <div className="flex items-center gap-2">
                <CalendarDays aria-hidden className="size-4 text-brand-500" />
                <dt className="sr-only">Established</dt>
                <dd>Established {site.established}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Globe2 aria-hidden className="size-4 text-brand-500" />
                <dt className="sr-only">Coverage</dt>
                <dd>Recruiting across the {recruitmentPositioning.markets}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Building2 aria-hidden className="size-4 text-brand-500" />
                <dt className="sr-only">Certification</dt>
                <dd>ISO 9001:2015 Certified</dd>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-6 xl:col-span-6">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* 02 — Introduction */}
      <Section labelledBy="intro-title" className="!pt-8 md:!pt-12">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <SectionHeading id="intro-title" eyebrow="Who we are" title="Specialists in SAP Talent." />
            <div data-reveal className="mt-7 space-y-5 body-copy max-w-2xl">
              <p>{recruitmentPositioning.detail}</p>
              <p>
                Established in September 2017, VMR Cloud Solutions Private Limited is an IT and consulting company headquartered in Bengaluru, India. We recruit contract and permanent SAP professionals for end customers and SAP service integrators, and our consulting and engineering teams work across SAP, Java and Python.
              </p>
            </div>
            <Link href="/about" data-reveal className="link-arrow mt-8">
              More about VMR <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>

          <aside data-reveal style={{ ["--reveal-delay" as string]: "100ms" }} className="lg:col-span-5">
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-surface px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Company at a glance</p>
              </div>
              <dl className="divide-y divide-line">
                {[
                  ["Legal name", site.legalName],
                  ["Established", site.established],
                  ["Headquarters", "Bengaluru, Karnataka"],
                  ["Specialism", "SAP recruitment & staffing"],
                  ["Recruiting for", "UK & Europe"],
                  ["Also delivering", "SAP, Java & Python consulting"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-5 gap-4 px-6 py-3.5 text-[0.925rem]">
                    <dt className="col-span-2 text-muted">{k}</dt>
                    <dd className="col-span-3 font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-surface px-5 py-4 font-display text-[0.95rem] font-bold text-ink">
              {pillars.map((p, i) => (
                <span key={p.title} className="inline-flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="size-1.5 rounded-full bg-accent-500" />}
                  {p.title}
                </span>
              ))}
            </p>
          </aside>
        </div>
      </Section>

      {/* 03 — Highlights */}
      <section aria-label="Company highlights" className="border-y border-line bg-surface">
        <div className="container-x">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}
                className={`flex flex-col py-10 md:py-12 ${i % 2 === 1 ? "border-l border-line pl-5 sm:pl-8" : "pr-4"} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:pl-8" : ""}`}
              >
                <dt className="order-2 mt-3 text-sm font-semibold text-ink-soft">{s.label}</dt>
                <dd className={`order-1 whitespace-nowrap font-display font-bold leading-none tracking-tight text-ink ${s.value.length > 6 ? "text-[clamp(1.35rem,0.9rem+1.6vw,2.4rem)]" : "text-[clamp(1.6rem,1.1rem+2vw,2.75rem)]"}`}>
                  {"countTo" in s ? <CountUp to={s.countTo} prefix={s.prefix} /> : s.value}
                </dd>
                <dd className="order-3 mt-1 text-[0.8rem] text-muted">{s.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 04 — Recruitment services */}
      <Section labelledBy="recruitment-title">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="recruitment-title"
              eyebrow="SAP Recruitment & Staffing"
              title="Contract, permanent and project staffing."
              text="Three specialist services for organisations delivering SAP, from a single contractor to a complete project team."
            />
            <Link href="/services#sap-recruitment" data-reveal className="btn btn-secondary shrink-0 self-start md:self-auto">
              All services <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="mt-12">
            <RecruitmentServiceCards />
          </div>
        </div>
      </Section>

      {/* 05 — SAP areas */}
      <Section tone="dark" labelledBy="sap-areas-title" className="overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark mask-fade-b" />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 size-[30rem] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="container-x relative">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              dark
              id="sap-areas-title"
              eyebrow="SAP Expertise"
              title="SAP Areas We Recruit For."
              text="From S/4HANA and BTP to functional modules, development and Basis."
            />
            <Link href="/sap-expertise" data-reveal className="btn btn-ghost-dark shrink-0 self-start md:self-auto">
              Explore SAP expertise <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="mt-12">
            <SapAreasGrid dark />
          </div>
        </div>
      </Section>

      {/* 06 — Employers & candidates */}
      <Section labelledBy="paths-title">
        <div className="container-x">
          <SectionHeading id="paths-title" eyebrow="How we can help" title="For employers and SAP professionals." />
          <div className="mt-12">
            <AudiencePaths />
          </div>
        </div>
      </Section>

      {/* Clients (supplied by VMR) */}
      <ClientsSection tone="surface" showLink />

      {/* 07 — Technology services */}
      <Section labelledBy="services-title">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="services-title"
              eyebrow="Technology services"
              title="Beyond recruitment: technology capabilities."
              text="Our consulting and engineering teams also deliver SAP, Java, Python and IT services."
            />
            <Link href="/services#technology-services" data-reveal className="btn btn-secondary shrink-0 self-start md:self-auto">
              View technology services <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
            {services.map((s, i) => (
              <ServiceCard key={s.slug} service={s} index={i} />
            ))}
          </div>
        </div>
      </Section>

      {/* 08 — Why VMR */}
      <Section tone="surface" labelledBy="why-title">
        <div className="container-x">
          <SectionHeading
            id="why-title"
            eyebrow="Why VMR"
            title="A Partner Focused on Technology and Business Outcomes."
            text="We combine technical depth with a consulting mindset, so technology decisions start from business needs."
          />
          <div className="mt-12">
            <WhyGrid />
          </div>
        </div>
      </Section>

      {/* 09 — Industries */}
      <Section labelledBy="industries-title">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="industries-title"
              eyebrow="Industries"
              title="Technology for Different Business Environments."
              text="Different industries face different technological challenges. We start by understanding the requirements of each organization."
            />
            <Link href="/industries" data-reveal className="link-arrow shrink-0">
              All industries <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {industries.map((ind, i) => {
              const Icon = genericIcons[ind.icon];
              return (
                <li key={ind.title} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms` }}>
                  <Link
                    href="/industries"
                    className="card card-hover group flex h-full items-center gap-4 p-4 md:p-5"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-brand-600 transition-colors group-hover:bg-brand-50">
                      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-[0.95rem] font-semibold leading-snug text-ink">{ind.title}</span>
                  </Link>
                </li>
              );
            })}
            <li data-reveal style={{ ["--reveal-delay" as string]: "180ms" }}>
              <Link
                href="/contact"
                className="group flex h-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-brand-300 bg-brand-50/60 p-4 text-[0.95rem] font-semibold text-brand-700 transition-colors hover:bg-brand-50 md:p-5"
              >
                Discuss your industry
                <ArrowUpRight aria-hidden className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </li>
          </ul>
        </div>
      </Section>

      {/* 10 — Certifications & contact CTA */}
      <CertificationsSection tone="surface" />
      <CtaBand
        title="Let's Talk About Your SAP Requirements."
        text="Whether you're hiring SAP talent or looking for your next SAP role, our team is ready to help."
        primary={{ label: "Contact Our Recruitment Team", href: "/contact" }}
        secondary={{ label: "Upload Your CV", href: "/upload-cv" }}
      />
    </>
  );
}
