import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApproachSteps, CtaBand, PageHero, ServiceCard } from "@/components/sections/shared";
import { serviceIcons } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/Section";
import { pillars } from "@/content/company";
import { services } from "@/content/services";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Our Services",
  description:
    "SAP consulting, Java and Python development, digital transformation, cloud solutions, IT staffing, digital engineering and application support from VMR Cloud Solutions.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        visual="sap"
        eyebrow="Our Services"
        title="Enterprise Technology Expertise. Business-Focused Solutions."
        text="We bring together technology consulting, software engineering and enterprise technology capabilities to support organizations across their technology requirements."
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        aside={
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {pillars.map((p, i) => (
              <li key={p.title} className="card flex gap-4 p-5">
                <span className="font-display text-sm font-bold text-brand-500">0{i + 1}</span>
                <span>
                  <span className="block font-display text-base font-bold text-ink">{p.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        }
      />

      <Section labelledBy="all-services">
        <div className="container-x">
          <SectionHeading id="all-services" eyebrow="Service portfolio" title="Eight capability areas, one partner." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
            {services.map((s, i) => (
              <ServiceCard key={s.slug} service={s} index={i} />
            ))}
          </div>
        </div>
      </Section>

      {/* Detailed index */}
      <Section tone="surface" labelledBy="service-index">
        <div className="container-x">
          <SectionHeading
            id="service-index"
            eyebrow="At a glance"
            title="What each service covers."
            text="A quick overview of the areas inside each service. Select a service to read more."
          />
          <ul className="mt-12 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {services.map((s) => {
              const Icon = serviceIcons[s.icon];
              return (
                <li key={s.slug} data-reveal>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group grid gap-4 p-6 transition-colors hover:bg-surface md:grid-cols-12 md:items-center md:gap-8 md:px-8"
                  >
                    <span className="flex items-center gap-4 md:col-span-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-muted">{s.number}</span>
                        <span className="block text-lg font-semibold tracking-tight text-ink">{s.title}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2 md:col-span-7">
                      {s.capabilities.slice(0, 4).map((c) => (
                        <span key={c.title} className="rounded-full border border-line bg-card px-3 py-1 text-[0.8rem] text-ink-soft">
                          {c.title}
                        </span>
                      ))}
                      {s.capabilities.length > 4 && (
                        <span className="px-1 py-1 text-[0.8rem] text-muted">+{s.capabilities.length - 4} more</span>
                      )}
                    </span>
                    <span className="hidden justify-end md:col-span-1 md:flex">
                      <ArrowRight aria-hidden className="size-5 text-brand-600 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section labelledBy="approach">
        <div className="container-x">
          <SectionHeading
            id="approach"
            eyebrow="How we work"
            title="A Structured Approach to Technology Delivery."
            text="Successful technology implementation begins with understanding business requirements and continues through thoughtful planning, engineering and ongoing support."
          />
          <div className="mt-14">
            <ApproachSteps />
          </div>
        </div>
      </Section>

      <CtaBand title="Not sure which service fits?" text="Tell us about your requirement and we'll help you identify the right approach and expertise." />
    </>
  );
}
