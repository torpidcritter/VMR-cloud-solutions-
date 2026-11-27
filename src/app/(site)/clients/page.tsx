import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Handshake } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/Section";
import { clients, type Client } from "@/content/clients";
import { recruitmentPositioning } from "@/content/recruitment";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Our Clients",
  description: `Organisations that have worked with ${site.name} on SAP, technology and talent requirements.`,
  path: "/clients",
});

function LogoTile({ client, index }: { client: Client; index: number }) {
  const square = client.w / client.h < 1.3;
  const body = (
    <>
      <div className="flex h-24 w-full items-center justify-center md:h-28">
        <Image
          src={client.logo}
          alt={client.name}
          width={client.w}
          height={client.h}
          sizes="(min-width: 1024px) 220px, 40vw"
          className={`w-auto max-w-[85%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.04] ${square ? "max-h-[4.5rem] md:max-h-20" : "max-h-12 md:max-h-14"}`}
        />
      </div>
      <div className="mt-4 flex w-full items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#0f1b33]">{client.name}</span>
          {client.sector && <span className="block truncate text-xs text-[#5b6578]">{client.sector}</span>}
        </span>
        {client.website && <ArrowUpRight aria-hidden className="size-4 shrink-0 text-[#5b6578] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
      </div>
    </>
  );
  const cls =
    "group flex h-full flex-col items-center rounded-xl border border-line bg-logo p-5 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-lift)] md:p-6";
  return (
    <li data-reveal style={{ ["--reveal-delay" as string]: `${(index % 4) * 60}ms` }}>
      {client.website ? (
        <a href={client.website} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${client.name} (opens in a new tab)`}>
          {body}
        </a>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

export default function ClientsPage() {
  const count = clients.length;
  return (
    <>
      {/* Own visual identity: a dark, quiet hero that lets the logos lead. */}
      <section aria-labelledby="clients-hero" className="on-dark relative -mt-[var(--header-h)] overflow-hidden bg-navy-950 pt-[var(--header-h)] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-dark mask-fade-b" />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-0 size-[34rem] rounded-full bg-brand-500/20 blur-[120px]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
        <div className="container-x relative pb-16 pt-10 md:pb-24 md:pt-14">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-[0.8rem] text-slate-400">
              <li>
                <Link href="/" className="u-link hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-slate-200">
                Our Clients
              </li>
            </ol>
          </nav>
          <div className="grid items-end gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="eyebrow">Our Clients</p>
              <h1 id="clients-hero" className="t-1 mt-5 !text-white">
                Organisations we have worked with.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
                We are proud to have supported technology and business teams across a range of organisations, from technology service providers to enterprises running complex operations.
              </p>
            </div>
            {count > 0 && (
              <dl className="flex gap-10 lg:col-span-4 lg:justify-end">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Organisations</dt>
                  <dd className="mt-2 font-display text-5xl font-bold tracking-tight text-white">{count}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Established</dt>
                  <dd className="mt-2 font-display text-5xl font-bold tracking-tight text-white">{site.establishedYear}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>

      <Section labelledBy="client-list">
        <div className="container-x">
          <h2 id="client-list" className="sr-only">
            Client list
          </h2>
          {count > 0 ? (
            <ul className={`grid grid-cols-2 gap-3 md:gap-4 ${count >= 6 ? "sm:grid-cols-3 lg:grid-cols-4" : count >= 3 ? "sm:grid-cols-3" : "mx-auto max-w-3xl"}`}>
              {clients.map((c, i) => (
                <LogoTile key={c.name} client={c} index={i} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <Building2 aria-hidden className="size-8 text-muted" strokeWidth={1.5} />
              <p className="mt-4 font-semibold text-ink">Our client showcase is being updated.</p>
              <p className="mt-1 text-sm text-muted">Please check back soon, or contact us for references.</p>
            </div>
          )}
          <p className="mt-6 text-xs text-muted">Logos are trademarks of their respective owners and are shown to indicate a working relationship.</p>
        </div>
      </Section>

      <Section tone="surface" labelledBy="partner-title">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-7">
            <SectionHeading
              id="partner-title"
              eyebrow="Work with us"
              title="Building an SAP team, or planning a project?"
              text={recruitmentPositioning.summary}
            />
          </div>
          <div data-reveal className="card p-7 md:p-8 lg:col-span-5">
            <Handshake aria-hidden className="size-7 text-brand-600" strokeWidth={1.5} />
            <p className="mt-5 font-display text-xl font-bold tracking-tight text-ink">Talk to our recruitment team</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">Contract, permanent and project staffing for SAP programmes.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link href="/contact?service=contract-sap-recruitment" className="btn btn-primary">
                Find SAP Talent <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/services#sap-recruitment" className="btn btn-secondary">
                Our services
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
