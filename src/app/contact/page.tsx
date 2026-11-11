import { Suspense } from "react";
import { Building2, Clock, Globe, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHero } from "@/components/sections/shared";
import { Section } from "@/components/ui/Section";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Contact VMR Cloud Solutions in Bengaluru to discuss SAP, Java, Python, cloud and IT consulting requirements. Call +91 93926 70130 or email info@vmrcloudsolutions.com.",
  path: "/contact",
});

export default function ContactPage() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(site.address.mapQuery)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address.mapQuery)}`;

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Let's Build Something Together."
        text="Have a technology requirement, business challenge or project idea? Connect with VMR Cloud Solutions to discuss your requirements and explore how our technology and consulting capabilities may support your objectives."
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      />

      <Section labelledBy="enquiry" className="!pt-14 md:!pt-20">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="card p-6 shadow-[var(--shadow-card)] md:p-10">
              <h2 id="enquiry" className="text-2xl font-bold tracking-tight">
                Business enquiry
              </h2>
              <p className="mt-2 text-[0.95rem] text-muted">Tell us what you need and our team will get back to you.</p>
              <div className="mt-8">
                <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-xl bg-surface" />}>
                  <ContactForm />
                </Suspense>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:col-span-5" aria-label="Contact information">
            <div className="card p-6 md:p-7">
              <div className="flex items-center gap-3">
                <Building2 aria-hidden className="size-5 text-brand-600" />
                <h2 className="text-base font-semibold">{site.legalName}</h2>
              </div>
              <ul className="mt-6 space-y-5 text-[0.95rem]">
                <Info icon={MapPin} label="Address">
                  <address className="not-italic leading-relaxed text-ink">
                    {site.address.lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </address>
                </Info>
                <Info icon={Mail} label="General enquiries">
                  <a href={`mailto:${site.email.general}`} className="u-link font-medium text-brand-700">
                    {site.email.general}
                  </a>
                </Info>
                <Info icon={UserRound} label="HR enquiries">
                  <a href={`mailto:${site.email.hr}`} className="u-link block font-medium text-brand-700">
                    {site.email.hr}
                  </a>
                  <a href={`mailto:${site.email.hrContact}`} className="u-link mt-1 block text-ink-soft">
                    {site.email.hrContact}
                  </a>
                </Info>
                <Info icon={Phone} label="Telephone">
                  <a href={site.phone.mobile.href} className="u-link block font-medium text-brand-700">
                    {site.phone.mobile.display}
                  </a>
                  <span className="mt-1 block text-ink-soft">
                    Office:{" "}
                    {site.phone.office.map((p, i) => (
                      <span key={p.href}>
                        {i > 0 && " / "}
                        <a href={p.href} className="u-link">
                          {i === 0 ? p.display : p.display.slice(-3)}
                        </a>
                      </span>
                    ))}
                  </span>
                </Info>
                <Info icon={Globe} label="Website">
                  <a href={site.url} className="u-link text-ink">
                    vmrcloudsolutions.com
                  </a>
                </Info>
              </ul>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-5 text-sm text-ink-soft">
              <Clock aria-hidden className="size-5 shrink-0 text-brand-600" />
              Prefer to talk? Call our team directly on the numbers above.
            </div>
          </aside>
        </div>
      </Section>

      <section aria-label="Map" className="border-t border-line bg-surface">
        <div className="container-x py-14 md:py-20">
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <iframe
              title={`Map showing ${site.legalName}, ${site.address.short}`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[22rem] w-full md:h-[26rem]"
            />
          </div>
          <a href={mapLink} target="_blank" rel="noopener noreferrer" className="link-arrow mt-4">
            Open in Google Maps
          </a>
        </div>
      </section>
    </>
  );
}

function Info({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon aria-hidden className="size-[1.1rem]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
        <span className="mt-1 block">{children}</span>
      </span>
    </li>
  );
}
