import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, MapPin, Users } from "lucide-react";
import { HeroVisual } from "@/components/sections/HeroVisual";
import {
  ApproachSteps,
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
            <p className="eyebrow text-[0.7rem] sm:text-xs">VMR Cloud Solutions · Enterprise Technology &amp; Consulting</p>
            <h1 className="t-display mt-6">
              Engineering Enterprise <span className="bg-gradient-to-r from-brand-600 to-[#0aa6e0] bg-clip-text text-transparent">Transformation.</span>
            </h1>
            <p className="mt-5 font-display text-lg font-semibold tracking-tight text-ink-soft sm:text-xl">
              Technology<span className="text-accent-500">.</span> Talent<span className="text-accent-500">.</span> Transformation<span className="text-accent-500">.</span>
            </p>
            <p className="lead mt-6 max-w-xl">
              We bring enterprise technology expertise, software engineering and IT consulting together to help businesses modernize their operations, build scalable solutions and navigate an evolving digital landscape.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/services" className="btn btn-primary">
                Explore Our Services <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/contact" className="btn btn-secondary">
                Talk to Our Team
              </Link>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
              <div className="flex items-center gap-2">
                <CalendarDays aria-hidden className="size-4 text-brand-500" />
                <dt className="sr-only">Established</dt>
                <dd>Established {site.established}</dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin aria-hidden className="size-4 text-brand-500" />
                <dt className="sr-only">Headquarters</dt>
                <dd>Bengaluru, India</dd>
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
            <SectionHeading id="intro-title" eyebrow="Who we are" title="Technology That Moves Businesses Forward." />
            <div data-reveal className="mt-7 space-y-5 body-copy max-w-2xl">
              <p>
                Established in September 2017, VMR Cloud Solutions Private Limited is an IT and consulting company based in Bengaluru, India.
              </p>
              <p>
                We focus on enterprise technology, software engineering and IT consulting, bringing together technical expertise and business understanding to support organizations in their digital journeys. With experience across technologies including SAP, Java and Python, our team works across different areas of enterprise technology and software development.
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
                  ["Core expertise", "SAP · Java · Python"],
                  ["Focus", "IT consulting & enterprise software"],
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

      {/* 04 — Services */}
      <Section labelledBy="services-title">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="services-title"
              eyebrow="What we do"
              title="Our Technology Capabilities."
              text="Technology consulting and engineering capabilities designed around evolving business requirements."
            />
            <Link href="/services" data-reveal className="btn btn-secondary shrink-0 self-start md:self-auto">
              View all services <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
            {services.map((s, i) => (
              <ServiceCard key={s.slug} service={s} index={i} />
            ))}
          </div>
        </div>
      </Section>

      {/* 05 — Technology expertise */}
      <Section tone="dark" labelledBy="tech-title" className="overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark mask-fade-b" />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 size-[30rem] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="container-x relative">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHeading
                dark
                id="tech-title"
                eyebrow="Technology expertise"
                title="Technology Expertise That Supports Business Growth."
                text="Our technical experience spans enterprise platforms, software engineering and modern application technologies."
              />
              <Link href="/technology" data-reveal className="btn btn-ghost-dark mt-9">
                Explore our expertise <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <ul className="grid gap-4 lg:col-span-7">
              {[
                { name: "SAP", kind: "Enterprise platforms", text: "Consulting, development, integration and support across SAP-based enterprise environments." },
                { name: "Java", kind: "Enterprise engineering", text: "Scalable applications, backend systems and APIs for business-critical software." },
                { name: "Python", kind: "Modern software", text: "Backend services, automation and data processing for flexible, fast-moving solutions." },
              ].map((t, i) => (
                <li
                  key={t.name}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
                  className="group grid grid-cols-[auto_1fr] items-center gap-6 rounded-2xl border border-white/10 bg-card/[0.03] p-6 transition-[background-color,border-color] duration-300 hover:border-sky-brand/40 hover:bg-card/[0.06] md:gap-10 md:p-8"
                >
                  <span className="w-28 font-display text-4xl font-bold tracking-tight text-white md:w-40 md:text-5xl">
                    {t.name}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-sky-brand">{t.kind}</span>
                    <span className="mt-2 block text-[0.95rem] leading-relaxed text-slate-300">{t.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 06 — Why VMR */}
      <Section labelledBy="why-title">
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

      {/* 07 — Delivery approach */}
      <Section tone="surface" labelledBy="approach-title">
        <div className="container-x">
          <SectionHeading
            id="approach-title"
            eyebrow="Our approach"
            title="From Business Challenges to Technology Solutions."
            text="Successful technology implementation begins with understanding business requirements and continues through planning, engineering and ongoing support."
          />
          <div className="mt-14">
            <ApproachSteps />
          </div>
        </div>
      </Section>

      {/* 08 — Industries */}
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

      {/* Clients & certifications (supplied by VMR) */}
      <ClientsSection tone="surface" />
      <CertificationsSection tone="white" />

      {/* 09 — Careers */}
      <Section tone="surface" labelledBy="careers-title" className="overflow-hidden">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-card">
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-grid mask-radial lg:block" />
            <div className="relative grid gap-10 p-8 md:p-12 lg:grid-cols-12 lg:p-16">
              <div className="lg:col-span-7" data-reveal>
                <p className="eyebrow">Careers</p>
                <h2 id="careers-title" className="t-2 mt-4">
                  Build Your Future With VMR.
                </h2>
                <p className="lead mt-5 max-w-xl">
                  We believe that technology evolves through people, ideas and continuous learning. Explore opportunities to develop your capabilities and contribute to technology-driven projects.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link href="/careers" className="btn btn-primary">
                    Explore Career Opportunities <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <a href={`mailto:${site.email.hr}`} className="btn btn-secondary">
                    {site.email.hr}
                  </a>
                </div>
              </div>
              <div className="lg:col-span-5" data-reveal style={{ ["--reveal-delay" as string]: "120ms" }}>
                <ul className="flex flex-wrap gap-2 lg:justify-end">
                  {["SAP Consulting", "Java Development", "Python Development", "Software Engineering", "Quality Assurance", "IT Consulting", "Internships"].map(
                    (r) => (
                      <li key={r} className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft">
                        {r}
                      </li>
                    ),
                  )}
                </ul>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-surface p-5 lg:ml-auto lg:max-w-sm">
                  <span className="grid size-11 place-items-center rounded-full bg-card text-brand-600">
                    <Users aria-hidden className="size-5" />
                  </span>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Experienced professionals and aspiring engineers are welcome to apply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 10 — Contact CTA */}
      <CtaBand />
    </>
  );
}
