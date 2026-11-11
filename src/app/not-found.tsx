import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { services } from "@/content/services";

export default function NotFound() {
  return (
    <section className="relative -mt-[4.5rem] overflow-hidden bg-gradient-to-b from-brand-50/70 to-white pt-[4.5rem]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial" />
      <div className="container-x relative py-24 md:py-32">
        <p className="eyebrow">Error 404</p>
        <h1 className="t-1 mt-5 max-w-2xl">This page could not be found.</h1>
        <p className="lead mt-5 max-w-xl">The page you are looking for may have been moved or no longer exists. Here are some helpful links instead.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            Back to home <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/contact" className="btn btn-secondary">
            Contact us
          </Link>
        </div>
        <div className="mt-16 max-w-3xl border-t border-line pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Our services</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
