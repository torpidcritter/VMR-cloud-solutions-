import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { footerQuickLinks, legalLinks, site } from "@/content/site";
import { services } from "@/content/services";

const socialPaths: Record<string, { label: string; d: string }> = {
  linkedin: {
    label: "LinkedIn",
    d: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-1 1.83-1.75 3.77-1.75 4 0 4.37 2.4 4.37 5.5v5.75h-4v-5.1c0-1.22-.02-2.8-1.7-2.8-1.72 0-1.98 1.34-1.98 2.71v5.19H9.5v-11Z",
  },
  x: {
    label: "X",
    d: "M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.7H5.58l11.09 14.5Z",
  },
  facebook: {
    label: "Facebook",
    d: "M13.5 21v-7.5H16l.5-3h-3V8.6c0-.87.3-1.6 1.6-1.6h1.5V4.3c-.3 0-1.2-.1-2.3-.1-2.4 0-3.8 1.4-3.8 4V10.5H8v3h2.5V21h3Z",
  },
  instagram: {
    label: "Instagram",
    d: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm4.8-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM12 3c-2.4 0-2.7 0-3.7.06-3.3.15-4.9 1.75-5.04 5.04C3.2 9.3 3.2 9.6 3.2 12s0 2.7.06 3.7c.15 3.3 1.75 4.9 5.04 5.04 1 .05 1.3.06 3.7.06s2.7 0 3.7-.06c3.3-.15 4.9-1.75 5.04-5.04.05-1 .06-1.3.06-3.7s0-2.7-.06-3.7C20.6 5 19 3.4 15.7 3.26 14.7 3.2 14.4 3 12 3Z",
  },
  youtube: {
    label: "YouTube",
    d: "M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z",
  },
};

export function Footer() {
  const socials = Object.entries(site.social).filter(([, url]) => Boolean(url));
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark relative overflow-hidden bg-navy-950 text-slate-300">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark mask-fade-b opacity-60" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />

      <div className="container-x relative pb-10 pt-16 md:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-3">
            <Link href="/" className="inline-flex rounded-2xl bg-logo px-5 py-3.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]" aria-label={`${site.name} – Home`}>
              <Image src="/brand/vmr-cloud-logo.png" alt={site.legalName} width={953} height={176} sizes="240px" className="h-11 w-auto" />
            </Link>
            <p className="mt-6 font-display text-lg font-semibold tracking-tight text-white">{site.tagline}</p>
            <p className="mt-3 max-w-sm text-[0.925rem] leading-relaxed text-slate-400">{site.shortAbout}</p>
            {socials.length > 0 && (
              <ul className="mt-6 flex gap-2" aria-label="Social media">
                {socials.map(([key, url]) => {
                  const s = socialPaths[key];
                  if (!s) return null;
                  return (
                    <li key={key}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className="grid size-10 place-items-center rounded-full border border-white/15 text-slate-300 transition-colors hover:border-sky-brand/60 hover:text-white"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                          <path d={s.d} />
                        </svg>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <FooterCol title="Quick Links" className="lg:col-span-2">
            {footerQuickLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="u-link transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterCol>

          <FooterCol title="Services" className="lg:col-span-3 lg:pl-4">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="u-link transition-colors hover:text-white">
                  {s.navTitle}
                </Link>
              </li>
            ))}
          </FooterCol>

          <FooterCol title="Contact" className="lg:col-span-4">
            {site.offices.map((o) => (
              <li key={o.name} className="flex gap-3">
                <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-sky-brand" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{o.name}</span>
                  <address className="mt-1 not-italic leading-relaxed">
                    {o.lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </address>
                </span>
              </li>
            ))}
            <li className="flex gap-3">
              <Mail aria-hidden className="mt-1 size-4 shrink-0 text-sky-brand" />
              <span className="flex flex-col gap-1">
                <a href={`mailto:${site.email.general}`} className="u-link hover:text-white">
                  {site.email.general}
                </a>
                <a href={`mailto:${site.email.hr}`} className="u-link hover:text-white">
                  {site.email.hr}
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <Phone aria-hidden className="mt-1 size-4 shrink-0 text-sky-brand" />
              <span className="flex flex-col gap-1">
                <a href={site.phone.mobile.href} className="u-link hover:text-white">
                  {site.phone.mobile.display}
                </a>
                <span>
                  {site.phone.office.map((p, i) => (
                    <span key={p.href}>
                      {i > 0 && " / "}
                      <a href={p.href} className="u-link hover:text-white">
                        {i === 0 ? p.display : p.display.slice(-3)}
                      </a>
                    </span>
                  ))}
                </span>
              </span>
            </li>
          </FooterCol>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-8 text-[0.8rem] text-slate-400 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>
              © {year} {site.legalName}. All Rights Reserved.
            </p>
            <p className="text-slate-500">
              CIN: {site.registration.cin} · GSTIN: {site.offices[0].gstin} (KA), {site.offices[1].gstin} (AP)
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="u-link hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] !text-white">{title}</h2>
      <ul className="mt-5 space-y-3 text-[0.925rem]">{children}</ul>
    </div>
  );
}
