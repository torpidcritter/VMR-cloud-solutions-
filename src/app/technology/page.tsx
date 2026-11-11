import Link from "next/link";
import { ArrowRight, Boxes, Braces, Cloud, Network, ShieldCheck, Terminal } from "lucide-react";
import { CtaBand, PageHero } from "@/components/sections/shared";
import { Section, SectionHeading } from "@/components/ui/Section";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Technology Expertise",
  description:
    "VMR Cloud Solutions' technical experience spans enterprise platforms, software engineering and modern application technologies, with core expertise in SAP, Java and Python.",
  path: "/technology",
});

const core = [
  {
    name: "SAP",
    icon: Boxes,
    kind: "Enterprise platforms",
    text: "Experience in SAP-related enterprise environments, supporting business processes, enterprise resources and operational workflows.",
    areas: ["SAP consulting", "SAP development", "SAP integration", "Application support", "System maintenance"],
    href: "/services/sap-consulting",
  },
  {
    name: "Java",
    icon: Braces,
    kind: "Enterprise engineering",
    text: "Engineering scalable enterprise applications, backend systems and business-critical software in Java.",
    areas: ["Application development", "Backend engineering", "API development", "Integration", "Modernization"],
    href: "/services/java-development",
  },
  {
    name: "Python",
    icon: Terminal,
    kind: "Modern software",
    text: "Building flexible Python solutions for backend services, automation and data processing.",
    areas: ["Backend engineering", "API development", "Process automation", "Data processing", "Integration"],
    href: "/services/python-development",
  },
];

const supporting = [
  {
    icon: Network,
    title: "Application Engineering",
    text: "Frontend and backend development, API integration, code reviews and deployment as part of structured software delivery.",
  },
  {
    icon: Cloud,
    title: "Cloud & Infrastructure",
    text: "Helping organizations understand and adopt appropriate cloud technologies, and build applications ready to run in the cloud.",
  },
  {
    icon: ShieldCheck,
    title: "Quality Engineering",
    text: "Software testing, debugging and quality assurance practices that keep releases dependable.",
  },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        visual="python"
        eyebrow="Technology Expertise"
        title="Technology expertise that supports business growth."
        text="Our technical experience spans enterprise platforms, software engineering and modern application technologies."
        crumbs={[{ label: "Home", href: "/" }, { label: "Technology Expertise" }]}
      />

      <Section labelledBy="core">
        <div className="container-x">
          <SectionHeading id="core" eyebrow="Core expertise" title="Three technologies at the centre of our work." />
          <ul className="mt-12 grid gap-5 lg:grid-cols-3">
            {core.map((t, i) => (
              <li key={t.name} data-reveal style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}>
                <Link href={t.href} className="card card-hover group flex h-full flex-col overflow-hidden">
                  <div className="relative overflow-hidden bg-navy-900 px-7 pb-8 pt-7 text-white">
                    <div aria-hidden className="absolute inset-0 bg-dots-dark" />
                    <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-500/40 blur-3xl transition-opacity group-hover:opacity-80" />
                    <div className="relative flex items-center justify-between">
                      <t.icon aria-hidden className="size-6 text-sky-brand" strokeWidth={1.6} />
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t.kind}</span>
                    </div>
                    <h3 className="relative mt-8 font-display text-5xl font-bold tracking-tight !text-white">{t.name}</h3>
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-[0.95rem] leading-relaxed text-muted">{t.text}</p>
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {t.areas.map((a) => (
                        <li key={a} className="rounded-full bg-surface px-3 py-1 text-[0.8rem] font-medium text-ink-soft">
                          {a}
                        </li>
                      ))}
                    </ul>
                    <span className="link-arrow mt-auto pt-7">
                      Related service <ArrowRight aria-hidden className="size-4" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="surface" labelledBy="supporting">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="supporting"
              eyebrow="Supporting capabilities"
              title="Engineering practices around our core."
              text="Alongside our core technologies, these capabilities support how we design, build and maintain solutions."
            />
          </div>
          <ul className="grid gap-4 lg:col-span-7">
            {supporting.map((s, i) => (
              <li key={s.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="card flex gap-5 p-6 md:p-7">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                <span>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">{s.text}</p>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="principle">
        <div className="container-x">
          <div data-reveal className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center">Our principle</p>
            <h2 id="principle" className="t-2 mt-4">
              Technology chosen for the business, not the other way round.
            </h2>
            <p className="lead mt-5">
              We start with business requirements and the existing technology environment, then recommend the technologies and approaches that fit, rather than defaulting to a single stack.
            </p>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
