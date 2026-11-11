import Image from "next/image";
import Link from "next/link";
import { GlobeVisual } from "./GlobeVisual";
import type { ReactNode } from "react";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { genericIcons, serviceIcons } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/Section";
import { approach, certifications, clients, whyVmr } from "@/content/company";
import type { Service } from "@/content/services";
import { site } from "@/content/site";

/* ------------------------------------------------------------------ */
/* Page hero for inner pages                                           */
/* ------------------------------------------------------------------ */

export function PageHero({
  eyebrow,
  title,
  text,
  crumbs,
  children,
  aside,
  visual,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  children?: ReactNode;
  aside?: ReactNode;
  /** Technology labels for the animated globe on the right (large screens). */
  visual?: readonly string[];
}) {
  const split = !!aside || !!visual;
  return (
    <section className="relative -mt-[var(--header-h)] overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 via-page to-page pt-[var(--header-h)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial" />
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-sky-brand/10 blur-3xl" />
      <div className="container-x relative pb-16 pt-10 md:pb-20 md:pt-14">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-[0.8rem] text-muted">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="text-line-strong">/</span>}
                  {c.href ? (
                    <Link href={c.href} className="u-link hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink-soft">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className={split ? "grid items-center gap-12 lg:grid-cols-12" : ""}>
          <div className={split ? "lg:col-span-7" : "max-w-3xl"}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="t-1 mt-5">
              {title}
            </h1>
            {text && (
              <p className="lead mt-6 max-w-2xl">
                {text}
              </p>
            )}
            {children && (
              <div className="mt-8 anim-fade-up" style={{ ["--d" as string]: "180ms" }}>
                {children}
              </div>
            )}
          </div>
          {aside && (
            <div className="anim-fade-up lg:col-span-5" style={{ ["--d" as string]: "200ms" }}>
              {aside}
            </div>
          )}
          {!aside && visual && (
            <div className="hidden lg:col-span-5 lg:block">
              <GlobeVisual items={visual} className="max-w-[28rem] xl:max-w-[32rem]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Service card                                                        */
/* ------------------------------------------------------------------ */

export function ServiceCard({ service, index = 0 }: { service: Service; index?: number }) {
  const Icon = serviceIcons[service.icon];
  return (
    <Link
      href={`/services/${service.slug}`}
      data-reveal
      style={{ ["--reveal-delay" as string]: `${(index % 4) * 60}ms` }}
      className="card card-hover group relative flex h-full flex-col overflow-hidden p-6 md:p-7"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-brand-500 to-sky-brand transition-transform duration-300 group-hover:scale-x-100"
      />
      <div className="flex items-start justify-between">
        <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-[background-color,color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:bg-brand-600 group-hover:text-white">
          <Icon aria-hidden className="size-[1.35rem]" strokeWidth={1.6} />
        </span>
        <span className="font-display text-sm font-semibold text-line-strong transition-colors group-hover:text-brand-300">
          {service.number}
        </span>
      </div>
      <h3 className="t-3 mt-6">{service.title}</h3>
      <p className="mt-2.5 flex-1 text-[0.925rem] leading-relaxed text-muted">{service.summary}</p>
      <span className="link-arrow mt-6">
        Learn more <ArrowRight aria-hidden className="size-4" />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery approach                                                   */
/* ------------------------------------------------------------------ */

export function ApproachSteps({
  steps = approach,
  dark = false,
}: {
  steps?: readonly { step?: string; title: string; text: string }[];
  dark?: boolean;
}) {
  return (
    <ol className="relative grid gap-0 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {/* connecting line (desktop) */}
      <span
        aria-hidden
        className={`absolute left-6 right-6 top-6 hidden h-px lg:block ${dark ? "bg-card/15" : "bg-line"}`}
      />
      {steps.map((s, i) => (
        <li
          key={s.title}
          data-reveal
          style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
          className="relative flex gap-5 pb-10 last:pb-0 md:pb-10 lg:flex-col lg:gap-0 lg:pb-0"
        >
          {/* vertical line (mobile) */}
          {i < steps.length - 1 && (
            <span aria-hidden className={`absolute left-6 top-12 h-[calc(100%-3rem)] w-px md:hidden ${dark ? "bg-card/15" : "bg-line"}`} />
          )}
          <span
            className={`relative z-10 grid size-12 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${
              dark ? "border border-white/20 bg-navy-900 text-sky-brand" : "border border-brand-200 bg-card text-brand-600 shadow-[0_0_0_6px_var(--color-surface)]"
            }`}
          >
            {s.step ?? String(i + 1).padStart(2, "0")}
          </span>
          <div className="lg:mt-6">
            <h3 className={`t-3 ${dark ? "!text-white" : ""}`}>{s.title}</h3>
            <p className={`mt-2 text-[0.95rem] leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Why VMR                                                             */
/* ------------------------------------------------------------------ */

export function WhyGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {whyVmr.map((item, i) => {
        const Icon = genericIcons[item.icon];
        return (
          <div
            key={item.title}
            data-reveal
            style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }}
            className="group bg-card p-7 transition-colors duration-300 hover:bg-surface md:p-8"
          >
            <div className="flex items-center gap-3">
              <Icon aria-hidden className="size-5 text-brand-600 transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={1.75} />
              <span className="font-display text-xs font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{item.text}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export function ClientsSection({ tone = "white" as "white" | "surface" }) {
  return (
    <Section tone={tone} labelledBy="clients-title">
      <div className="container-x">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="clients-title"
            eyebrow="Our Clients"
            title="Organisations we have worked with."
            text="We are proud to have supported technology and business teams across a range of organisations."
          />
        </div>
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {clients.map((c, i) => (
            <li
              key={c.name}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms` }}
              className="group card !bg-logo flex h-28 items-center justify-center p-5 transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[var(--shadow-card)] md:h-32"
            >
              <Image
                src={c.logo}
                alt={c.name}
                width={c.w}
                height={c.h}
                sizes="(min-width: 1024px) 200px, 40vw"
                className={`w-auto max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03] ${c.w / c.h < 1.3 ? "max-h-16 md:max-h-[4.5rem]" : "max-h-12 md:max-h-14"}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Certifications                                                      */
/* ------------------------------------------------------------------ */

export function CertificationsSection({ tone = "surface" as "white" | "surface" }) {
  return (
    <Section tone={tone} labelledBy="certs-title">
      <div className="container-x">
        <SectionHeading
          id="certs-title"
          eyebrow="Certifications & Registrations"
          title="Quality and compliance you can rely on."
          text="Our certifications and registrations reflect a commitment to well-managed, accountable delivery."
        />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {certifications.map((c, i) => (
            <li key={c.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="card flex flex-col p-6 md:p-7">
              <div className="flex h-36 items-center justify-center rounded-xl bg-logo">
                <Image src={c.logo} alt={`${c.title} – ${c.subtitle}`} width={c.w} height={c.h} sizes="300px" className="max-h-32 w-auto max-w-full object-contain mix-blend-multiply" />
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="text-lg font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-1 text-sm font-medium text-brand-700">{c.subtitle}</p>
                <p className="mt-3 text-[0.925rem] leading-relaxed text-muted">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p data-reveal className="mt-6 text-sm text-muted">
          Registered company · CIN {site.registration.cin} · GSTIN {site.registration.gstin}
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Final call to action                                                */
/* ------------------------------------------------------------------ */

export function CtaBand({
  title = "Let's Build Something Together.",
  text = "Have a technology requirement or business challenge? Connect with our team to explore the right approach.",
  primary = { label: "Talk to Our Team", href: "/contact" },
}: {
  title?: string;
  text?: string;
  primary?: { label: string; href: string };
}) {
  return (
    <section className="on-dark relative overflow-hidden bg-navy-900 text-white" aria-labelledby="cta-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 size-[36rem] -translate-y-1/2 rounded-full bg-brand-500/25 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[24rem] rounded-full bg-sky-brand/10 blur-[100px]" />
      <svg aria-hidden viewBox="0 0 400 120" className="pointer-events-none absolute bottom-0 right-0 w-[30rem] max-w-[70%] opacity-40">
        <path d="M0 110C120 104 260 70 400 6c-90 70-230 104-400 110Z" fill="#FF4E3E" opacity="0.85" />
      </svg>
      <div className="container-x relative py-20 md:py-24">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7" data-reveal>
            <p className="eyebrow">Get in touch</p>
            <h2 id="cta-title" className="t-2 mt-4 !text-white">
              {title}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">{text}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={primary.href} className="btn btn-light">
                {primary.label} <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/services" className="btn btn-ghost-dark">
                Explore Our Services
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5" data-reveal style={{ ["--reveal-delay" as string]: "120ms" }}>
            <div className="rounded-2xl border border-white/10 bg-card/[0.04] p-6 backdrop-blur-sm">
              <a href={`mailto:${site.email.general}`} className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-card/5">
                <span className="grid size-11 place-items-center rounded-full bg-card/10 text-sky-brand">
                  <Mail aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-wider text-slate-400">Email us</span>
                  <span className="block font-medium text-white">{site.email.general}</span>
                </span>
              </a>
              <div className="my-2 h-px bg-card/10" />
              <a href={site.phone.mobile.href} className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-card/5">
                <span className="grid size-11 place-items-center rounded-full bg-card/10 text-sky-brand">
                  <Phone aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-wider text-slate-400">Call us</span>
                  <span className="block font-medium text-white">{site.phone.mobile.display}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
