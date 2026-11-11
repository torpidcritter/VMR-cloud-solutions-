import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AudiencePaths, SapAreasGrid } from "@/components/sections/recruitment";
import { PageHero } from "@/components/sections/shared";
import { Section, SectionHeading } from "@/components/ui/Section";
import { recruitmentPositioning, recruitmentServices, sapAreaGroups } from "@/content/recruitment";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "SAP Expertise – SAP Areas We Recruit For",
  description:
    "SAP S/4HANA, HANA, BTP, FI/CO, SD, MM, PP, EWM, HCM, CRM, SCM, QM, PM, PS, BI/BW, ABAP, Fiori/UI5 and Basis: the SAP areas VMR Cloud recruits for across the UK and Europe.",
  path: "/sap-expertise",
});

const totalAreas = sapAreaGroups.reduce((n, g) => n + g.areas.length, 0);
const permanent = recruitmentServices.find((s) => s.icon === "permanent")!;
const project = recruitmentServices.find((s) => s.icon === "project")!;

export default function SapExpertisePage() {
  return (
    <>
      <PageHero
        visual={sapAreaGroups.flatMap((g) => g.areas.map((a) => a.code))}
        eyebrow="SAP Expertise"
        title="SAP Areas We Recruit For."
        text={recruitmentPositioning.detail}
        crumbs={[{ label: "Home", href: "/" }, { label: "SAP Expertise" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/contact?service=contract-sap-recruitment" className="btn btn-primary">
            Find SAP Talent <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/upload-cv" className="btn btn-secondary">
            Upload Your CV
          </Link>
        </div>
      </PageHero>

      <Section labelledBy="areas-title">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="areas-title"
              eyebrow="Coverage"
              title="Platforms, modules and technical specialisms."
              text={`${totalAreas} SAP areas across four groups, from functional consultants to developers and Basis specialists.`}
            />
          </div>
          <div className="mt-12">
            <SapAreasGrid />
          </div>
        </div>
      </Section>

      <Section tone="surface" labelledBy="roles-title" id="roles">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="roles-title"
              eyebrow="Roles and projects"
              title="The SAP roles we recruit for."
              text="We recruit contract and permanent SAP professionals for the roles and project types that make implementations succeed."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {[
              { title: "Roles", items: permanent.items },
              { title: "Project types", items: project.items },
            ].map((col, i) => (
              <div key={col.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 90}ms` }} className="card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{col.title}</p>
                <ul className="mt-4 divide-y divide-line">
                  {col.items.map((item) => (
                    <li key={item} className="py-3 text-[0.95rem] font-medium text-ink first:pt-0 last:pb-0">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section labelledBy="paths-title">
        <div className="container-x">
          <SectionHeading id="paths-title" eyebrow="Get started" title="Hiring, or looking for your next SAP role?" />
          <div className="mt-12">
            <AudiencePaths />
          </div>
        </div>
      </Section>
    </>
  );
}
