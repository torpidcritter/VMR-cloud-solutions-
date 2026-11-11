import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApproachSteps, ClientsSection, CtaBand, PageHero } from "@/components/sections/shared";
import { genericIcons } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/Section";
import { industries } from "@/content/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Industries We Serve",
  description:
    "Technology expertise across business environments: information technology, enterprise businesses, utilities, financial services, manufacturing, retail and telecommunications.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        orbit={["SAP", "ERP", "APIs", "Cloud", "Automation", "Data"]}
        eyebrow="Industries We Serve"
        title="Technology Expertise Across Business Environments."
        text="Different industries face different technological challenges. Our approach focuses on understanding organizational requirements and identifying technology capabilities that can support business objectives."
        crumbs={[{ label: "Home", href: "/" }, { label: "Industries" }]}
      />

      <Section labelledBy="industries">
        <div className="container-x">
          <h2 id="industries" className="sr-only">
            Industries
          </h2>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {industries.map((ind, i) => {
              const Icon = genericIcons[ind.icon];
              return (
                <li
                  key={ind.title}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }}
                  className="card card-hover group flex flex-col p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-display text-sm font-semibold text-line-strong">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{ind.title}</h3>
                  <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-muted">{ind.text}</p>
                  <ul className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                    {ind.needs.map((n) => (
                      <li key={n} className="rounded-full bg-surface px-3 py-1 text-[0.8rem] font-medium text-ink-soft">
                        {n}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
            <li data-reveal className="flex flex-col justify-between rounded-[var(--radius-card)] bg-navy-900 p-7 text-white lg:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-brand">Your industry</p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight !text-white">Don&apos;t see your sector?</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-300">
                  Our consulting-led approach starts with your requirements, wherever you operate.
                </p>
              </div>
              <Link href="/contact" className="btn btn-light mt-8 self-start">
                Talk to us <ArrowRight aria-hidden className="size-4" />
              </Link>
            </li>
          </ul>
        </div>
      </Section>

      <Section tone="surface" labelledBy="how">
        <div className="container-x">
          <SectionHeading
            id="how"
            eyebrow="Our approach"
            title="Understanding the environment comes first."
            text="Every industry engagement follows the same structured path, adapted to the organization's context."
          />
          <div className="mt-14">
            <ApproachSteps />
          </div>
        </div>
      </Section>

      <ClientsSection />
      <CtaBand />
    </>
  );
}
