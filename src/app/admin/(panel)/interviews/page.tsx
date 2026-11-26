import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listInterviews } from "@/lib/data/interviews";
import { INTERVIEW_STATUSES, INTERVIEW_STATUS_LABELS, istToday } from "@/lib/data/constants";
import { PageHeader, Panel, withParams } from "@/components/admin/ui";
import { InterviewList, istTime } from "@/components/admin/interview-ui";

export const metadata: Metadata = { title: "Interviews" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 20) : undefined);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const istDate = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const startOfIstDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toISOString();
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("applications.view");
  const sp = await searchParams;
  const view = one(sp.view) === "month" ? "month" : "agenda";
  const mine = one(sp.mine) === "1";
  const status = (INTERVIEW_STATUSES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status) : undefined;
  const today = istToday();
  const month = /^\d{4}-\d{2}$/.test(one(sp.month) ?? "") ? one(sp.month)! : today.slice(0, 7);
  const current = { view: view === "month" ? "month" : undefined, mine: mine ? "1" : undefined, status, month: view === "month" ? month : undefined };
  const url = (changes: Record<string, string | undefined>) => withParams("/admin/interviews", current, changes);
  const userId = mine ? me.id : undefined;

  const chip = (active: boolean, href: string, label: React.ReactNode) => (
    <Link href={href} className={`a-chip ${active ? "!border-btn !bg-btn !text-white" : ""}`} aria-current={active ? "true" : undefined}>
      {label}
    </Link>
  );
  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chip(view === "agenda", url({ view: undefined, month: undefined }), <><List aria-hidden className="size-4" /> Upcoming</>)}
      {chip(view === "month", url({ view: "month" }), <><CalendarDays aria-hidden className="size-4" /> Month</>)}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      {chip(!mine, url({ mine: undefined }), "Everyone")}
      {chip(mine, url({ mine: "1" }), "Mine")}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      {chip(!status, url({ status: undefined }), "Any status")}
      {INTERVIEW_STATUSES.map((st) => chip(status === st, url({ status: st }), INTERVIEW_STATUS_LABELS[st]))}
    </div>
  );

  if (view === "agenda") {
    const [upcoming, recent] = await Promise.all([
      listInterviews({ from: startOfIstDay(today), to: startOfIstDay(addDays(today, 60)), userId, status: status ?? "scheduled" }, 200),
      listInterviews({ from: startOfIstDay(addDays(today, -14)), to: startOfIstDay(today), userId, status }, 200),
    ]);
    const needsOutcome = recent.filter((i) => i.status === "scheduled");
    return (
      <>
        <PageHeader title="Interviews" description="Every interview across all candidates, in India time. Schedule one from an application." />
        {toolbar}
        <div className="grid gap-6">
          {needsOutcome.length > 0 && (
            <Panel title={`Waiting for an outcome (${needsOutcome.length})`} bodyClass="">
              <InterviewList items={needsOutcome} empty="" />
            </Panel>
          )}
          <Panel title={`Next 60 days${status && status !== "scheduled" ? ` · ${INTERVIEW_STATUS_LABELS[status as keyof typeof INTERVIEW_STATUS_LABELS]}` : ""}`} bodyClass="">
            <InterviewList items={upcoming} empty="No interviews in the next 60 days." />
          </Panel>
          <Panel title="Last 14 days" bodyClass="">
            <InterviewList items={[...recent].reverse()} empty="No interviews in the last 14 days." />
          </Panel>
        </div>
      </>
    );
  }

  // Month grid, Monday first, in IST.
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -lead);
  const nextMonth = addDays(first, 32).slice(0, 7);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = Math.ceil((lead + Number(addDays(`${nextMonth}-01`, -1).slice(8))) / 7);
  const items = await listInterviews({ from: startOfIstDay(gridStart), to: startOfIstDay(addDays(gridStart, weeks * 7)), userId, status }, 1000);
  const byDay = new Map<string, typeof items>();
  for (const i of items) {
    const d = istDate(i.scheduled_at);
    byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  const title = new Date(`${first}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Interviews" description="Every interview across all candidates, in India time. Schedule one from an application." />
      {toolbar}
      <section aria-labelledby="month-h" className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 id="month-h" className="flex-1 text-sm font-semibold">
            {title} · {items.length} interview{items.length === 1 ? "" : "s"}
          </h2>
          <Link href={url({ month: prevMonth })} className="a-btn !px-2" aria-label="Previous month">
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link href={url({ month: today.slice(0, 7) })} className="a-btn">
            Today
          </Link>
          <Link href={url({ month: nextMonth })} className="a-btn !px-2" aria-label="Next month">
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        {/* Phones get a plain list of this month's interviews; the grid needs room. */}
        <div className="sm:hidden">
          <InterviewList items={items.filter((i) => istDate(i.scheduled_at).startsWith(month))} empty="No interviews this month." />
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <div className="grid min-w-[46rem] grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-line px-2 py-1.5 text-xs font-semibold text-muted">
                {d}
              </div>
            ))}
            {days.slice(0, weeks * 7).map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.startsWith(month);
              return (
                <div key={d} className={`min-h-28 border-b border-r border-line p-1.5 text-xs ${inMonth ? "" : "bg-surface-2/50 text-muted"}`}>
                  <p className={`mb-1 inline-grid size-6 place-items-center rounded-full font-semibold tabular-nums ${d === today ? "bg-btn text-white" : ""}`}>{Number(d.slice(8))}</p>
                  <ul className="grid gap-1">
                    {list.slice(0, 4).map((i) => (
                      <li key={i.id}>
                        <Link
                          href={`/admin/interviews/${i.id}`}
                          className={`block truncate rounded px-1.5 py-0.5 hover:underline ${i.status === "cancelled" ? "bg-surface-2 text-muted line-through" : i.status === "completed" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-brand-50 text-brand-700 dark:text-brand-200"}`}
                          title={`${istTime(i.scheduled_at)} ${i.candidate_name}, ${i.round}`}
                        >
                          <span className="tabular-nums">{istTime(i.scheduled_at)}</span> {i.candidate_name}
                        </Link>
                      </li>
                    ))}
                    {list.length > 4 && <li className="px-1.5 text-muted">+{list.length - 4} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
