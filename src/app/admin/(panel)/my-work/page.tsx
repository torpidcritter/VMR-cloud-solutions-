import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Briefcase, CalendarClock, Target } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { myWork } from "@/lib/data/workspace";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/data/constants";
import { ApplicationStatusBadge, OpeningStatusBadge, PageHeader, Panel, StatCard, formatDate, formatDateTime } from "@/components/admin/ui";
import { PriorityBadge } from "@/components/admin/candidate-ui";
import { InterviewList } from "@/components/admin/interview-ui";
import { can } from "@/lib/auth/permissions";
import { istToday } from "@/lib/data/constants";
import { listTasks } from "@/lib/data/tasks";
import { TaskList } from "@/components/admin/task-list";

export const metadata: Metadata = { title: "My work" };

export default async function MyWorkPage() {
  const me = await requireAdmin("applications.view");
  const [w, openTasks] = await Promise.all([myWork(me.id), listTasks({ owner: me.id, status: "open" }, 50)]);
  // Overdue, due within a week, or undated: the ones worth seeing first.
  const weekOut = new Date(new Date(`${istToday()}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const soon = openTasks.filter((t) => !t.due_on || t.due_on <= weekOut).slice(0, 8);
  const month = new Date().toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const left = w.target !== null ? w.target - w.hiresThisMonth : null;
  const targetHint = left === null ? "No target set this month" : left > 0 ? `${left} to go to reach the target` : "Target reached";

  return (
    <>
      <PageHeader title={`Good to see you, ${me.name.split(" ")[0]}`} description="Your applications, interviews and follow-ups in one place." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My open applications" value={w.open} icon={Briefcase} href="/admin/pipeline?assigned=me" />
        <StatCard label="Interviews in 7 days" value={w.interviews.length} icon={CalendarClock} tone="violet" href="/admin/interviews?mine=1" />
        <StatCard label="Follow-ups due" value={w.followUps.length} icon={BellRing} tone={w.followUps.length ? "red" : "green"} href="/admin/candidates?owner=me&followUp=due" />
        <StatCard label={`Placements in ${month}`} value={w.target !== null ? `${w.hiresThisMonth} / ${w.target}` : w.hiresThisMonth} icon={Target} tone="green" hint={targetHint} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Upcoming interviews" bodyClass="">
            <InterviewList items={w.interviews} empty="No interviews in the next 7 days." />
          </Panel>

          <Panel title="Needs a nudge" bodyClass="">
            {w.stale.length ? (
              <ul className="divide-y divide-line">
                {w.stale.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <Link href={`/admin/applications/${a.id}`} className="min-w-0 flex-1 hover:text-brand-600">
                      <span className="block truncate font-medium">{a.full_name}</span>
                      <span className="text-xs text-muted">
                        #{a.number} · {a.opening_title ?? a.position}
                      </span>
                    </Link>
                    <ApplicationStatusBadge status={a.status} />
                    <span className="w-24 text-right text-xs font-medium text-accent-600">{a.days} days in stage</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nothing of yours has sat in one stage for more than 7 days.</p>
            )}
          </Panel>

          <Panel title="My applications by stage">
            {w.open ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {APPLICATION_STATUSES.filter((s) => w.byStage[s]).map((s) => (
                  <li key={s}>
                    <Link href={`/admin/applications?assigned=me&status=${s}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:border-brand-300">
                      {APPLICATION_STATUS_LABELS[s]}
                      <span className="font-semibold tabular-nums">{w.byStage[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No open applications are assigned to you.</p>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title={`My tasks${openTasks.length ? ` (${openTasks.length} open)` : ""}`}
            bodyClass=""
            actions={
              <Link href="/admin/tasks" className="text-sm text-brand-600 hover:underline">
                All tasks
              </Link>
            }
          >
            <TaskList tasks={soon} meId={me.id} canManage={can(me.role, "tasks.manage")} showOwner={false} empty={openTasks.length ? "Nothing due in the next 7 days." : "No open tasks."} />
          </Panel>

          <Panel title="Follow-ups due" bodyClass="">
            {w.followUps.length ? (
              <ul className="divide-y divide-line">
                {w.followUps.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Link href={`/admin/candidates/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-600">
                      {c.full_name}
                    </Link>
                    <PriorityBadge priority={c.priority} />
                    <span className="text-xs text-accent-600">{formatDate(`${c.follow_up_on}T00:00:00+05:30`)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No follow-ups due on candidates you own.</p>
            )}
          </Panel>

          <Panel title="My job openings" bodyClass="">
            {w.openings.length ? (
              <ul className="divide-y divide-line">
                {w.openings.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Link href={`/admin/pipeline?opening=${o.id}`} className="min-w-0 flex-1 hover:text-brand-600">
                      <span className="block truncate font-medium">{o.title}</span>
                      <span className="text-xs text-muted">
                        {o.applications} application{o.applications === 1 ? "" : "s"} · {o.hired} of {o.vacancies} filled
                      </span>
                    </Link>
                    <OpeningStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">You aren&apos;t a recruiter on any job opening.</p>
            )}
          </Panel>

          <Panel title="My recent activity" bodyClass="">
            {w.recent.length ? (
              <ul className="divide-y divide-line">
                {w.recent.map((r) => (
                  <li key={r.id} className="px-5 py-2.5 text-sm">
                    <p className="truncate">{r.summary}</p>
                    <p className="text-xs text-muted">{formatDateTime(r.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nothing yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
