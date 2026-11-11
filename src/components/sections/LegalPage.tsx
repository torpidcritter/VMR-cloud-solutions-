import type { ReactNode } from "react";
import { PageHero } from "@/components/sections/shared";

export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: string; children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} text={intro} crumbs={[{ label: "Home", href: "/" }, { label: title }]} />
      <section className="bg-white py-16 md:py-20">
        <div className="container-x">
          <div className="prose-legal mx-auto max-w-3xl">
            <p className="!text-sm !text-muted">Last updated: {updated}</p>
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
