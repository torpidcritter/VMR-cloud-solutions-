import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { ApproachSteps, CtaBand, PageHero, ServiceCard } from "@/components/sections/shared";
import { serviceIcons } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getService, services, type Service } from "@/content/services";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return pageMetadata({
    title: s.title,
    description: `${s.headline} ${s.summary}`,
    path: `/services/${s.slug}`,
  });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const Icon = serviceIcons[service.icon];
  const related = service.related.map((r) => getService(r)).filter(Boolean) as Service[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.summary,
    serviceType: service.title,
    provider: { "@type": "Organization", name: site.legalName, url: site.url },
    areaServed: "IN",
    url: `${site.url}/services/${service.slug}`,
  };

  return (
    <>
      <PageHero
        eyebrow={`Service ${service.number} · ${service.title}`}
        title={service.headline}
        text={service.summary}
        crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: service.title }]}
        aside={<HeroAside service={service} />}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/contact?service=${service.slug}`} className="btn btn-primary">
            Discuss your requirement <ArrowRight aria-hidden className="size-4" />
          </Link>
          <a href="#capabilities" className="btn btn-secondary">
            Our capabilities
          </a>
        </div>
      </PageHero>

      {/* Introduction */}
      <Section labelledBy="intro">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading id="intro" eyebrow="Overview" title={`${service.title} at VMR`} />
            <span data-reveal className="mt-8 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-brand text-white shadow-[0_18px_40px_-18px_rgba(31,79,184,0.7)]">
              <Icon aria-hidden className="size-7" strokeWidth={1.6} />
            </span>
          </div>
          <div data-reveal className="space-y-5 body-copy text-[1.05rem] lg:col-span-7 lg:pt-10">
            {service.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className="!mt-8 grid gap-3 sm:grid-cols-3">
              {service.outcomes.map((o) => (
                <li key={o} className="rounded-xl border border-line bg-surface p-4 text-sm font-medium leading-snug text-ink">
                  <Check aria-hidden className="mb-2 size-4 text-brand-600" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Business challenges */}
      <Section tone="surface" labelledBy="challenges">
        <div className="container-x">
          <SectionHeading
            id="challenges"
            eyebrow="Business challenges"
            title="The challenges we help address."
          />
          <ul className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
            {service.challenges.map((c, i) => (
              <li
                key={c.title}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
                className="card relative overflow-hidden p-7"
              >
                <span aria-hidden className="absolute right-5 top-4 font-display text-5xl font-bold leading-none text-surface-2">
                  {i + 1}
                </span>
                <CircleAlert aria-hidden className="relative size-5 text-accent-500" strokeWidth={1.75} />
                <h3 className="relative mt-5 text-lg font-semibold tracking-tight">{c.title}</h3>
                <p className="relative mt-2 text-[0.95rem] leading-relaxed text-muted">{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Capabilities: three layout variations */}
      <Capabilities service={service} />

      {/* Technology landscape */}
      <Section tone={service.layout === "panel" ? "white" : "surface"} labelledBy="landscape">
        <div className="container-x grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading id="landscape" eyebrow="Technical expertise" title={service.landscapeTitle} text={service.landscapeIntro} />
          </div>
          <ul data-reveal className="flex flex-wrap gap-3 lg:col-span-7 lg:justify-end">
            {service.landscape.map((t) => (
              <li
                key={t}
                className="rounded-full border border-line bg-card px-5 py-2.5 text-[0.925rem] font-semibold text-ink shadow-[0_1px_2px_rgba(15,27,51,0.04)]"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Engagement approach */}
      <Section tone={service.layout === "panel" ? "surface" : "white"} labelledBy="engagement">
        <div className="container-x">
          <SectionHeading
            id="engagement"
            eyebrow="Engagement approach"
            title="How a typical engagement runs."
            text="Each engagement is shaped around your requirements. This is the structure we usually follow."
          />
          <div className="mt-14">
            <ApproachSteps steps={service.engagement} />
          </div>
        </div>
      </Section>

      {/* Related */}
      <Section tone={service.layout === "panel" ? "white" : "surface"} labelledBy="related">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="related" eyebrow="Related services" title="Often combined with." />
            <Link href="/services" data-reveal className="link-arrow shrink-0">
              All services <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
            {related.map((r, i) => (
              <ServiceCard key={r.slug} service={r} index={i} />
            ))}
          </div>
        </div>
      </Section>

      <CtaBand
        title={`Let's talk about ${service.title}.`}
        text="Share your requirement and our team will get back to you to discuss the right approach."
        primary={{ label: "Talk to Our Team", href: `/contact?service=${service.slug}` }}
      />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}

function HeroAside({ service }: { service: Service }) {
  const Icon = serviceIcons[service.icon];
  if (service.layout === "panel") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-7 text-white shadow-[0_30px_60px_-30px_rgba(11,24,56,0.8)]">
        <div aria-hidden className="absolute inset-0 bg-dots-dark" />
        <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <Icon aria-hidden className="size-7 text-sky-brand" strokeWidth={1.5} />
            <span className="font-display text-5xl font-bold text-white/10">{service.number}</span>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">What you get</p>
          <ul className="mt-4 space-y-3">
            {service.outcomes.map((o) => (
              <li key={o} className="flex gap-3 text-[0.95rem] text-slate-200">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-brand" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  if (service.layout === "columns") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {service.capabilities.slice(0, 4).map((c, i) => (
          <div key={c.title} className={`card p-5 ${i === 0 ? "bg-gradient-to-br from-[#2a63db] to-[#427df4] !border-transparent text-white" : ""}`}>
            {i === 0 ? (
              <Icon aria-hidden className="size-6 text-white" strokeWidth={1.6} />
            ) : (
              <span className="font-display text-xs font-bold text-brand-500">0{i + 1}</span>
            )}
            <p className={`mt-6 text-sm font-semibold leading-snug ${i === 0 ? "text-white" : "text-ink"}`}>{c.title}</p>
          </div>
        ))}
      </div>
    );
  }
  // split
  return (
    <div className="card overflow-hidden shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-4 border-b border-line bg-surface px-6 py-5">
        <span className="grid size-11 place-items-center rounded-xl bg-card text-brand-600 ring-1 ring-line">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Service {service.number}</span>
          <span className="block font-display text-lg font-bold text-ink">{service.title}</span>
        </span>
      </div>
      <ul className="divide-y divide-line">
        {service.capabilities.slice(0, 5).map((c) => (
          <li key={c.title} className="flex items-center gap-3 px-6 py-3.5 text-[0.925rem] text-ink-soft">
            <span className="size-1.5 rounded-full bg-gradient-to-br from-brand-500 to-sky-brand" />
            {c.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Capabilities({ service }: { service: Service }) {
  if (service.layout === "panel") {
    return (
      <Section tone="dark" labelledBy="capabilities-h" id="capabilities" className="overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark mask-fade-b" />
        <div aria-hidden className="pointer-events-none absolute -right-32 top-20 size-[28rem] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="container-x relative">
          <SectionHeading
            dark
            id="capabilities-h"
            eyebrow="Our capabilities"
            title="What we deliver."
            text={`The areas covered by our ${service.title} service.`}
          />
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-card/10 sm:grid-cols-2 lg:grid-cols-3">
            {service.capabilities.map((c, i) => (
              <li key={c.title} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }} className="bg-navy-900 p-7 transition-colors hover:bg-navy-800">
                <span className="font-display text-xs font-bold text-sky-brand">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight !text-white">{c.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-300">{c.text}</p>
              </li>
            ))}
            {service.capabilities.length % 3 !== 0 && (
              <li
                data-reveal
                className={`flex flex-col justify-between gap-6 bg-gradient-to-br from-[#2a63db] to-[#1f4fb8] p-7 ${
                  service.capabilities.length % 3 === 1 ? "lg:col-span-2" : ""
                } ${service.capabilities.length % 2 === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}
              >
                <p className="font-display text-lg font-semibold leading-snug text-white">Need something specific? We&apos;ll shape the engagement around your requirement.</p>
                <Link href={`/contact?service=${service.slug}`} className="btn btn-light self-start">
                  Talk to our team <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            )}
          </ul>
        </div>
      </Section>
    );
  }

  if (service.layout === "columns") {
    return (
      <Section labelledBy="capabilities-h" id="capabilities">
        <div className="container-x">
          <SectionHeading
            id="capabilities-h"
            eyebrow="Our capabilities"
            title="What we deliver."
            align="center"
            text={`The areas covered by our ${service.title} service.`}
          />
          <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {service.capabilities.map((c, i) => (
              <li key={c.title} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }} className="border-t-2 border-line pt-6 transition-colors hover:border-brand-500">
                <span className="font-display text-sm font-bold text-brand-500">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  // split
  return (
    <Section labelledBy="capabilities-h" id="capabilities">
      <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              id="capabilities-h"
              eyebrow="Our capabilities"
              title="What we deliver."
              text={`The areas covered by our ${service.title} service.`}
            />
            <Link href={`/contact?service=${service.slug}`} data-reveal className="link-arrow mt-8">
              Enquire about this service <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
          {service.capabilities.map((c, i) => (
            <li
              key={c.title}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${(i % 2) * 70}ms` }}
              className="card card-hover flex gap-4 p-6"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Check aria-hidden className="size-4" />
              </span>
              <span>
                <h3 className="text-base font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-1.5 text-[0.925rem] leading-relaxed text-muted">{c.text}</p>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
