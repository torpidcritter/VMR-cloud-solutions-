import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Boxes, MapPin, Phone, UserRound } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHero } from "@/components/sections/shared";
import { Section } from "@/components/ui/Section";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Contact VMR Cloud Solutions to discuss contract or permanent SAP recruitment, SAP project staffing, or SAP, Java, Python and IT consulting requirements. Call +91 9392670130 or email rajesh.v@vmrcloudsolutions.com.",
  path: "/contact",
});

export default function ContactPage() {
  const mapSrc = (q: string) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  const mapLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  return (
    <>
      <PageHero
        visual={["S/4HANA", "FI/CO", "SD", "MM", "BTP", "ABAP", "Fiori/UI5", "Basis", "Java", "Python", "Cloud", "APIs"]}
        eyebrow="Contact Us"
        title="Let's Talk About Your Requirements."
        text="Hiring SAP contractors, recruiting permanent SAP staff or staffing an SAP project? Or exploring a technology requirement? Tell us what you need and our team will get back to you."
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      />

      <Section labelledBy="enquiry" className="!pt-14 md:!pt-20">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="min-w-0 lg:col-span-7">
            <div className="card p-6 shadow-[var(--shadow-card)] md:p-10">
              <h2 id="enquiry" className="text-2xl font-bold tracking-tight">
                Employer &amp; business enquiry
              </h2>
              <p className="mt-2 text-[0.95rem] text-muted">For SAP talent, staffing or technology services. Looking for a role? <Link href="/upload-cv" className="font-semibold text-brand-700 underline underline-offset-2">Upload your CV</Link> instead.</p>
              <div className="mt-8">
                <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-xl bg-surface" />}>
                  <ContactForm />
                </Suspense>
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-4 lg:col-span-5" aria-label="Contact information">
            <Link href="/upload-cv" className="group flex items-center gap-4 rounded-[var(--radius-card)] bg-navy-900 p-6 text-white transition-colors hover:bg-navy-800 md:p-7">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-sky-brand">SAP professionals</span>
                <span className="mt-1 block font-display text-lg font-bold">Upload your CV</span>
                <span className="mt-1 block text-sm text-slate-300">Be considered for contract and permanent SAP roles.</span>
              </span>
              <ArrowUpRight aria-hidden className="size-5 shrink-0 text-sky-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-surface px-6 py-4 md:px-7">
                <h2 className="text-base font-semibold">Contact us directly</h2>
              </div>
              <ul className="divide-y divide-line">
                {site.contacts.map((c) => {
                  const Icon = c.kind === "phone" ? Phone : c.label.startsWith("HR") ? UserRound : Boxes;
                  return (
                    <li key={c.label}>
                      <a href={c.href} className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-surface md:px-7">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">{c.label}</span>
                          <span className="mt-1 block truncate font-semibold text-ink group-hover:text-brand-700">{c.value}</span>
                          {c.kind !== "phone" && c.label !== "HR Team" && <span className="block text-sm text-muted">{c.name}</span>}
                        </span>
                        <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="card p-6 md:p-7">
              <h2 className="text-base font-semibold">Our offices</h2>
              <ul className="mt-5 space-y-5">
                {site.offices.map((o) => (
                  <li key={o.name} className="flex gap-4">
                    <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-600" />
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">{o.name}</span>
                      <address className="mt-1 not-italic leading-relaxed text-ink-soft">{o.lines.join(", ")}</address>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Section>

      <section aria-labelledby="offices" className="border-t border-line bg-surface">
        <div className="container-x py-14 md:py-20">
          <p className="eyebrow">Our offices</p>
          <h2 id="offices" className="t-2 mt-4">
            Where to find us.
          </h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {site.offices.map((o) => (
              <li key={o.name} className="card overflow-hidden">
                <iframe
                  title={`Map showing ${site.legalName}, ${o.name}, ${o.city}`}
                  src={mapSrc(o.mapQuery)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block h-64 w-full border-b border-line bg-surface-2 md:h-72"
                />
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between md:p-7">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{o.name}</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">{o.city}</h3>
                    <address className="mt-2 not-italic text-[0.925rem] leading-relaxed text-muted">{o.lines.join(", ")}</address>
                  </div>
                  <a href={mapLink(o.mapQuery)} target="_blank" rel="noopener noreferrer" className="link-arrow shrink-0">
                    Directions
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

