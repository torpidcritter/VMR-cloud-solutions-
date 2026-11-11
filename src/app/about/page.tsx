import Link from "next/link";
import { ArrowRight, Eye, Target } from "lucide-react";
import { CertificationsSection, ClientsSection, CtaBand, PageHero } from "@/components/sections/shared";
import { Section, SectionHeading } from "@/components/ui/Section";
import { pillars, timeline, values } from "@/content/company";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Us",
  description:
    "VMR Cloud Solutions Private Limited is an IT and consulting company established in September 2017 and headquartered in Bengaluru, with experience in SAP, Java and Python.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About VMR Cloud Solutions"
        title="Building Technology Partnerships. Enabling Business Growth."
        text="An information technology and consulting company established in September 2017 and headquartered in Bengaluru, Karnataka."
        crumbs={[{ label: "Home", href: "/" }, { label: "About Us" }]}
      />

      {/* Introduction */}
      <Section labelledBy="who">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading id="who" eyebrow="Who we are" title="Technology expertise with a business focus." />
          </div>
          <div data-reveal className="space-y-5 body-copy text-[1.05rem] lg:col-span-7">
            <p>
              VMR Cloud Solutions Private Limited is an information technology and consulting company established in September 2017 and headquartered in Bengaluru, Karnataka.
            </p>
            <p>
              We work across enterprise technology and software development, with technical experience in SAP, Java, Python and related technologies. Our focus is on bringing together technology expertise, engineering capabilities and consulting to address business requirements.
            </p>
            <p>
              As technology continues to reshape industries, we aim to help organizations adapt, modernize and develop the capabilities required to move forward.
            </p>
          </div>
        </div>

        <div className="container-x mt-16">
          <ul className="grid gap-4 md:grid-cols-3">
            {pillars.map((p, i) => (
              <li key={p.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="card p-7">
                <span className="brand-rule block" />
                <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Journey */}
      <Section tone="surface" labelledBy="journey">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <SectionHeading id="journey" eyebrow="Our journey" title="From 2017 to today." text="A steady focus on technology consulting and engineering." />
            </div>
          </div>
          <ol className="relative lg:col-span-8">
            <span aria-hidden className="absolute bottom-2 left-[0.6875rem] top-2 w-px bg-gradient-to-b from-brand-500 via-sky-brand to-line" />
            {timeline.map((t, i) => (
              <li key={t.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 90}ms` }} className="relative pb-12 pl-12 last:pb-0">
                <span aria-hidden className="absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2 border-brand-500 bg-white">
                  <span className="size-2 rounded-full bg-brand-500" />
                </span>
                <p className="font-display text-sm font-bold text-brand-600">{t.period}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{t.title}</h3>
                <p className="mt-2 max-w-xl text-[0.975rem] leading-relaxed text-muted">{t.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Mission & vision */}
      <Section labelledBy="mission">
        <h2 id="mission" className="sr-only">
          Mission and vision
        </h2>
        <div className="container-x grid gap-5 md:grid-cols-2">
          <article data-reveal className="relative overflow-hidden rounded-3xl bg-navy-900 p-8 text-white md:p-12">
            <div aria-hidden className="absolute inset-0 bg-dots-dark" />
            <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="relative">
              <Target aria-hidden className="size-7 text-sky-brand" strokeWidth={1.5} />
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] !text-sky-brand">Our Mission</h3>
              <p className="mt-4 font-display text-xl font-semibold leading-snug tracking-tight md:text-2xl">
                To deliver practical technology and consulting solutions that help organizations address complex business challenges, strengthen their digital capabilities and achieve sustainable growth.
              </p>
            </div>
          </article>
          <article data-reveal style={{ ["--reveal-delay" as string]: "100ms" }} className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8 md:p-12">
            <Eye aria-hidden className="size-7 text-brand-600" strokeWidth={1.5} />
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] !text-brand-700">Our Vision</h3>
            <p className="mt-4 font-display text-xl font-semibold leading-snug tracking-tight text-ink md:text-2xl">
              To become a trusted technology and consulting partner for businesses by continuously developing our expertise, embracing innovation and delivering meaningful technology outcomes.
            </p>
          </article>
        </div>
      </Section>

      {/* Values */}
      <Section tone="surface" labelledBy="values">
        <div className="container-x">
          <SectionHeading id="values" eyebrow="Our values" title="The principles that guide our work." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {values.map((v, i) => (
              <li key={v.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 60}ms` }} className="card card-hover p-6">
                <span className="font-display text-sm font-bold text-brand-500">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{v.title}</h3>
                <p className="mt-2 text-[0.925rem] leading-relaxed text-muted">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Culture & people */}
      <Section labelledBy="people">
        <div className="container-x grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <SectionHeading
              id="people"
              eyebrow="Our people & culture"
              title="The People Behind Our Technology."
              text="Technology is driven by people, ideas and continuous learning. Our team brings together consultants, engineers and specialists who learn from each other and from every engagement."
            />
            <div data-reveal className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/careers" className="btn btn-primary">
                Join our team <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/contact" className="btn btn-secondary">
                Contact us
              </Link>
            </div>
          </div>
          <ul data-reveal className="grid grid-cols-2 gap-4 lg:col-span-6">
            {[
              ["Learning", "Exposure to evolving enterprise technologies."],
              ["Collaboration", "Working closely across teams and with clients."],
              ["Ownership", "Accountability for quality and outcomes."],
              ["Growth", "Room to build skills and take on responsibility."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-line p-6">
                <p className="font-display text-lg font-bold">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Corporate information */}
      <Section tone="surface" labelledBy="corporate">
        <div className="container-x">
          <SectionHeading id="corporate" eyebrow="Corporate information" title="Company details." />
          <dl data-reveal className="mt-10 grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Registered name", site.legalName],
              ["Company type", site.registration.type],
              ["Date of incorporation", site.incorporationDate],
              ["CIN", site.registration.cin],
              ["GSTIN", site.registration.gstin],
              ["Registrar of Companies", `ROC ${site.registration.roc}`],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-line p-6 sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{k}</dt>
                <dd className="mt-2 font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p data-reveal className="mt-6 text-sm text-muted">
            Registered office: {site.address.lines.join(", ")}
          </p>
        </div>
      </Section>

      <ClientsSection />
      <CertificationsSection />
      <CtaBand />
    </>
  );
}
