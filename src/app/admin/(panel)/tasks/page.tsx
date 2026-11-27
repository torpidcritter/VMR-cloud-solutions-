import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarCheck, ListTodo } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listTasks, taskCounts, taskOwnerOptions, type TaskFilters } from "@/lib/data/tasks";
import { PageHeader, Panel, StatCard, withParams } from "@/components/admin/ui";
import { TaskList } from "@/components/admin/task-list";
import { TaskForm } from "@/components/admin/task-ui";

export const metadata: Metadata = { title: "Tasks" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 40) : undefined);
const DUE = [
  { key: undefined, label: "All open" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "week", label: "Next 7 days" },
  { key: "none", label: "No date" },
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const manage = can(me.role, "tasks.manage");
  // Without tasks.manage a person only ever sees their own list.
  const who = manage ? (one(sp.who) ?? "me") : "me";
  const status = one(sp.status) === "done" ? "done" : "open";
  const due = status === "open" ? (DUE.find((d) => d.key && d.key === one(sp.due))?.key as TaskFilters["due"]) : undefined;
  const owner = who === "me" ? me.id : who === "all" ? undefined : who;
  const [tasks, counts, owners] = await Promise.all([listTasks({ owner, status, due }), taskCounts(owner), manage ? taskOwnerOptions() : Promise.resolve([])]);
  const current = { who: manage && who !== "me" ? who : undefined, status: status === "done" ? "done" : undefined, due };
  const url = (changes: Record<string, string | undefined>) => withParams("/admin/tasks", current, changes);
  const chip = (on: boolean) => `a-chip ${on ? "!border-btn !bg-btn !text-white" : ""}`;

  return (
    <>
      <PageHeader title="Tasks" description="To-dos for you and the team, linked to the candidate, opening or client they're about." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={counts.open} icon={ListTodo} href={url({ due: undefined, status: undefined })} />
        <StatCard label="Overdue" value={counts.overdue} icon={AlarmClock} tone={counts.overdue ? "red" : "green"} href={url({ due: "overdue", status: undefined })} />
        <StatCard label="Due today" value={counts.today} icon={CalendarCheck} tone="amber" href={url({ due: "today", status: undefined })} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {manage && (
              <form className="flex items-center gap-2">
                {current.status && <input type="hidden" name="status" value={current.status} />}
                {due && <input type="hidden" name="due" value={due} />}
                <label htmlFor="who" className="sr-only">
                  Whose tasks
                </label>
                <select id="who" name="who" defaultValue={who} className="a-field !w-auto !py-1.5 text-sm">
                  <option value="me">My tasks</option>
                  <option value="all">Everyone&apos;s tasks</option>
                  {owners
                    .filter((o) => o.id !== me.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button className="a-btn !py-1.5 text-sm">Show</button>
              </form>
            )}
            <nav aria-label="Filter tasks" className="flex flex-wrap gap-2">
              {DUE.map((d) => (
                <Link key={d.label} href={url({ due: d.key, status: undefined })} className={chip(status === "open" && due === d.key)} aria-current={status === "open" && due === d.key ? "true" : undefined}>
                  {d.label}
                </Link>
              ))}
              <Link href={url({ due: undefined, status: "done" })} className={chip(status === "done")} aria-current={status === "done" ? "true" : undefined}>
                Done
              </Link>
            </nav>
          </div>
          <div className="card">
            <TaskList
              tasks={tasks}
              meId={me.id}
              canManage={manage}
              showOwner={who !== "me"}
              empty={status === "done" ? "Nothing ticked off yet." : due ? "Nothing here. Nice." : "No open tasks. Add one to keep track of what's next."}
            />
          </div>
        </div>
        <Panel title="New task">
          <TaskForm meId={me.id} owners={owners} />
        </Panel>
      </div>
    </>
  );
}
