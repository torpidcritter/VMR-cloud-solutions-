import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChartColumn,
  Database,
  Network,
  ServerCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  audiencePaths,
  projectPhases,
  recruitmentServices,
  sapAreaGroups,
  type RecruitmentIcon,
  type SapAreaGroup,
} from "@/content/recruitment";

export const recruitmentIcons: Record<RecruitmentIcon, LucideIcon> = {
  contract: UsersRound,
  permanent: BriefcaseBusiness,
  project: Network,
};

const groupIcons: Record<SapAreaGroup["icon"], LucideIcon> = {
  platform: Database,
  functional: Users,
  analytics: ChartColumn,
  infrastructure: ServerCog,
};

/** Accent per service so the three offerings read as distinct. */
const serviceAccent = [
  { rule: "from-brand-500 to-brand-400", chip: "bg-brand-50 text-brand-600", hover: "group-hover:bg-brand-600" },
  { rule: "from-sky-brand to-brand-400", chip: "bg-sky-soft text-[#0284b0] dark:bg-sky-brand/10 dark:text-sky-brand", hover: "group-hover:bg-[#0284b0]" },
  { rule: "from-accent-500 to-accent-400", chip: "bg-accent-500/10 text-accent-600", hover: "group-hover:bg-accent-600" },
];

/* ------------------------------------------------------------------ */
/* Three recruitment services as cards (home page)                     */
/* ------------------------------------------------------------------ */

export function RecruitmentServiceCards() {
  return (
    <ol className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      {recruitmentServices.map((s, i) => {
        const Icon = recruitmentIcons[s.icon];
        const accent = serviceAccent[i % serviceAccent.length];
        return (
          <li key={s.slug} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="group card card-hover relative flex flex-col overflow-hidden">
            <span aria-hidden className={`h-[3px] w-full bg-gradient-to-r ${accent.rule}`} />
            <div className="flex flex-1 flex-col p-6 md:p-8">
              <div className="flex items-start justify-between">
                <span className={`grid size-12 place-items-center rounded-xl transition-colors duration-300 group-hover:text-white ${accent.chip} ${accent.hover}`}>
                  <Icon aria-hidden className="size-[1.35rem]" strokeWidth={1.6} />
                </span>
                <span className="font-display text-sm font-semibold text-muted">{s.letter}</span>
              </div>
              <h3 className="t-3 mt-6">{s.title}</h3>
              <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted">{s.summary}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                {s.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[0.925rem] text-ink-soft">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={`/services#${s.slug}`} className="link-arrow mt-7 after:absolute after:inset-0">
                Learn more<span className="sr-only"> about {s.title}</span> <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Detailed service sections (services page)                           */
/* ------------------------------------------------------------------ */

export function RecruitmentServiceDetails() {
  return (
    <div className="space-y-6 md:space-y-8">
      {recruitmentServices.map((s, i) => {
        const Icon = recruitmentIcons[s.icon];
        const accent = serviceAccent[i % serviceAccent.length];
        return (
          <article
            key={s.slug}
            id={s.slug}
            aria-labelledby={`${s.slug}-title`}
            data-reveal
            className="card relative scroll-mt-[calc(var(--header-h)+1.5rem)] overflow-hidden"
          >
            <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${accent.rule}`} />
            <div className="grid gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12">
              <div className="lg:col-span-7">
                <div className="flex items-center gap-4">
                  <span className={`grid size-12 place-items-center rounded-xl ${accent.chip}`}>
                    <Icon aria-hidden className="size-[1.35rem]" strokeWidth={1.6} />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Service {s.letter}</span>
                </div>
                <h3 id={`${s.slug}-title`} className="t-2 mt-6 !text-[clamp(1.5rem,1.2rem+1.1vw,2.1rem)]">
                  {s.title}
                </h3>
                <p className="body-copy mt-4 max-w-2xl">{s.intro}</p>
                <dl className="mt-8 grid gap-5 sm:grid-cols-3">
                  {s.highlights.map((h) => (
                    <div key={h.title} className="border-t border-line pt-4">
                      <dt className="text-sm font-semibold text-ink">{h.title}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted">{h.text}</dd>
                    </div>
                  ))}
                </dl>
                {s.icon === "project" && (
                  <div className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Staffing across every project phase</p>
                    <ol className="mt-3 flex flex-wrap items-center gap-2">
                      {projectPhases.map((p, n) => (
                        <li key={p} className="flex items-center gap-2">
                          <span className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft">{p}</span>
                          {n < projectPhases.length - 1 && <ArrowRight aria-hidden className="size-3.5 text-line-strong" />}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <Link href={s.cta.href} className="btn btn-primary mt-9">
                  {s.cta.label} <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
              <div className="lg:col-span-5">
                <div className="h-full rounded-xl border border-line bg-surface p-6 md:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{s.listTitle}</p>
                  <ul className="mt-5 divide-y divide-line">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-center gap-3 py-3 text-[0.95rem] font-medium text-ink first:pt-0 last:pb-0">
                        <Check aria-hidden className="size-4 shrink-0 text-brand-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SAP areas we recruit for                                            */
/* ------------------------------------------------------------------ */

export function SapAreasGrid({ dark = false }: { dark?: boolean }) {
  const border = dark ? "border-white/10" : "border-line";
  return (
    <div className={`overflow-hidden rounded-2xl border ${border}`}>
      {sapAreaGroups.map((g, gi) => {
        const Icon = groupIcons[g.icon];
        return (
          <section
            key={g.id}
            aria-labelledby={`sap-group-${g.id}`}
            data-reveal
            style={{ ["--reveal-delay" as string]: `${gi * 70}ms` }}
            className={`grid lg:grid-cols-12 ${gi > 0 ? `border-t ${border}` : ""}`}
          >
            <header className={`flex gap-4 border-b p-6 md:p-7 lg:col-span-4 lg:border-b-0 lg:border-r ${border} ${dark ? "bg-white/[0.03]" : "bg-surface"}`}>
              <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${dark ? "text-sky-brand" : "text-brand-600"}`} strokeWidth={1.75} />
              <div>
                <h3 id={`sap-group-${g.id}`} className={`text-base font-semibold tracking-tight ${dark ? "!text-white" : ""}`}>
                  {g.title}
                </h3>
                <p className={`mt-1 text-sm leading-relaxed ${dark ? "text-slate-400" : "text-muted"}`}>{g.text}</p>
                <p className={`mt-3 text-xs font-semibold ${dark ? "text-slate-500" : "text-muted"}`}>
                  {g.areas.length} {g.areas.length === 1 ? "area" : "areas"}
                </p>
              </div>
            </header>
            <ul className={`-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:col-span-8 ${g.areas.length > 3 ? "xl:grid-cols-4" : ""}`}>
              {g.areas.map((a) => (
                <li
                  key={a.code}
                  className={`group/area relative flex min-h-[6.25rem] ${g.areas.length === 1 ? "col-span-full" : ""} flex-col justify-center border-b border-r px-5 py-4 transition-colors duration-300 ${border} ${
                    dark ? "hover:bg-white/[0.04]" : "hover:bg-brand-50/50"
                  }`}
                >
                  <span className={`font-display text-lg font-bold tracking-tight md:text-xl ${dark ? "text-white" : "text-ink"}`}>
                    <span className={`mr-1 text-[0.7em] font-semibold ${dark ? "text-slate-500" : "text-muted"}`}>SAP</span>
                    {a.code}
                  </span>
                  <span className={`mt-1 text-[0.8rem] leading-snug ${dark ? "text-slate-400" : "text-muted"}`}>{a.name}</span>
                  <span
                    aria-hidden
                    className={`absolute bottom-0 left-5 h-[2px] w-0 transition-[width] duration-300 group-hover/area:w-8 ${dark ? "bg-sky-brand" : "bg-brand-500"}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employer and candidate paths                                        */
/* ------------------------------------------------------------------ */

export function AudiencePaths() {
  const panels = [
    { key: "employers", data: audiencePaths.employers, dark: true },
    { key: "candidates", data: audiencePaths.candidates, dark: false },
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      {panels.map(({ key, data, dark }, i) => (
        <section
          key={key}
          aria-labelledby={`path-${key}`}
          data-reveal
          style={{ ["--reveal-delay" as string]: `${i * 100}ms` }}
          className={`relative overflow-hidden rounded-2xl p-7 md:p-10 ${dark ? "on-dark bg-navy-900 text-white" : "border border-line bg-card"}`}
        >
          {dark && <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/25 blur-3xl" />}
          <div className="relative">
            <p className="eyebrow">{data.eyebrow}</p>
            <h3 id={`path-${key}`} className={`t-2 mt-4 !text-[clamp(1.5rem,1.2rem+1vw,2rem)] ${dark ? "!text-white" : ""}`}>
              {data.title}
            </h3>
            <p className={`mt-3 max-w-md leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{data.text}</p>
            <ul className={`mt-8 divide-y ${dark ? "divide-white/10 border-y border-white/10" : "divide-line border-y border-line"}`}>
              {data.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group flex items-center justify-between gap-4 py-4">
                    <span>
                      <span className={`block font-semibold ${dark ? "text-white" : "text-ink group-hover:text-brand-700"}`}>{l.label}</span>
                      <span className={`block text-sm ${dark ? "text-slate-400" : "text-muted"}`}>{l.text}</span>
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className={`size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${dark ? "text-sky-brand" : "text-brand-600"}`}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
