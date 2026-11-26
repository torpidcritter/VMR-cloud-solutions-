import Link from "next/link";
import { Check, Trash2 } from "lucide-react";
import type { Task } from "@/lib/data/tasks";
import { istToday } from "@/lib/data/constants";
import { ConfirmButton } from "./forms";
import { PriorityBadge } from "./candidate-ui";
import { formatDate } from "./ui";
import { deleteTaskAction, toggleTaskAction } from "@/app/admin/actions/tasks";

/** Server-rendered task rows with tick-off and delete. */
export function TaskList({
  tasks,
  meId,
  canManage,
  showOwner = true,
  showLinks = true,
  empty,
}: {
  tasks: Task[];
  meId: string;
  canManage: boolean;
  showOwner?: boolean;
  showLinks?: boolean;
  empty: string;
}) {
  if (!tasks.length) return <p className="px-5 py-4 text-sm text-muted">{empty}</p>;
  const today = istToday();
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const mine = t.owner_id === meId || t.created_by === meId || canManage;
        const done = t.status === "done";
        const overdue = !done && !!t.due_on && t.due_on < today;
        const dueToday = !done && t.due_on === today;
        return (
          <li key={t.id} className="flex items-start gap-3 px-5 py-3 text-sm">
            {mine ? (
              <form action={toggleTaskAction} className="mt-0.5">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="done" value={done ? "0" : "1"} />
                <button
                  className={`grid size-5 place-items-center rounded-md border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-line-strong bg-card hover:border-brand-400"}`}
                  aria-label={done ? `Reopen: ${t.title}` : `Mark done: ${t.title}`}
                  title={done ? "Reopen" : "Mark done"}
                >
                  {done ? <Check aria-hidden className="size-3.5" /> : null}
                </button>
              </form>
            ) : (
              <span className="mt-0.5 size-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className={done ? "text-muted line-through" : "font-medium"}>{t.title}</p>
              {t.notes && <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{t.notes}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {t.due_on && (
                  <span className={overdue ? "font-semibold text-accent-600" : dueToday ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
                    {overdue ? "Overdue · " : dueToday ? "Due today · " : "Due "}
                    {formatDate(t.due_on)}
                  </span>
                )}
                {t.priority !== "normal" && <PriorityBadge priority={t.priority} />}
                {showOwner && <span>For {t.owner_id === meId ? "me" : t.owner_name}</span>}
                {done && t.completed_at && <span>Done {formatDate(t.completed_at)}</span>}
                {showLinks && t.candidate_id && (
                  <Link href={`/admin/candidates/${t.candidate_id}`} className="text-brand-600 hover:underline">
                    {t.candidate_name}
                    {t.application_number ? ` · #${t.application_number}` : ""}
                  </Link>
                )}
                {showLinks && t.opening_id && (
                  <Link href={`/admin/openings/${t.opening_id}`} className="text-brand-600 hover:underline">
                    {t.opening_title}
                  </Link>
                )}
                {showLinks && t.client_id && (
                  <Link href={`/admin/clients/${t.client_id}`} className="text-brand-600 hover:underline">
                    {t.client_name}
                  </Link>
                )}
              </p>
            </div>
            {mine && (
              <div className="flex shrink-0 items-center gap-1">
                <ConfirmButton action={deleteTaskAction} hidden={{ id: t.id }} className="a-btn !px-2 !py-1" title="Delete this task?" confirmLabel="Delete task" confirm={t.title}>
                  <Trash2 aria-hidden className="size-3.5" />
                  <span className="sr-only">Delete {t.title}</span>
                </ConfirmButton>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
