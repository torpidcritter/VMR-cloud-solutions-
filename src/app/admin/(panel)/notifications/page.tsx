import type { Metadata } from "next";
import { Bell, BriefcaseBusiness, Building2, CalendarClock, FileText, UserCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listNotifications } from "@/lib/data/notifications";
import { SubmitButton } from "@/components/admin/forms";
import { EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { markAllReadAction, openNotificationAction } from "../../actions/notifications";

export const metadata: Metadata = { title: "Notifications" };

const ICON = { assign: UserCheck, interview: CalendarClock, application: FileText, client: Building2, requirement: BriefcaseBusiness } as const;

export default async function NotificationsPage() {
  const me = await requireAdmin();
  const items = await listNotifications(me.id);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton className="a-btn" pendingLabel="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
      {items.length ? (
        <ul className="card divide-y divide-line">
          {items.map((n) => {
            const Icon = ICON[n.kind as keyof typeof ICON] ?? Bell;
            return (
              <li key={n.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className={`flex w-full items-start gap-3 px-5 py-3.5 text-left text-sm hover:bg-surface ${n.read_at ? "text-ink-soft" : ""}`}>
                    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${n.read_at ? "bg-surface-2 text-muted" : "bg-brand-50 text-brand-600"}`}>
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read_at ? "" : "font-semibold text-ink"}`}>
                        {!n.read_at && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </span>
                      <span className="block text-xs text-muted">{formatDateTime(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent-600" />}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No notifications yet" icon={Bell}>
          You&apos;ll hear here when someone assigns you a candidate, an application, an opening or a client, or puts you on an interview panel.
        </EmptyState>
      )}
    </div>
  );
}
