"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  Columns3,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  pipeline: Columns3,
  interviews: CalendarClock,
  mywork: ClipboardList,
  applications: FileText,
  candidates: Users,
  openings: BriefcaseBusiness,
  enquiries: MessageSquare,
  users: UserCog,
  activity: Activity,
  settings: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Admin" className="grid gap-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{g.label}</p>
          <ul className="grid gap-0.5">
            {g.items.map((n) => {
              const Icon = ICONS[n.icon];
              const on = active(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      on ? "bg-brand-50 text-brand-600" : "text-ink-soft hover:bg-surface hover:text-ink"
                    }`}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="flex-1">{n.label}</span>
                    {n.badge ? <span className="rounded-full bg-btn px-1.5 py-px text-[0.68rem] font-bold tabular-nums text-white">{n.badge > 99 ? "99+" : n.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** "sidebar": the left column on large screens. "drawer": the menu button and slide-in panel below that. */
export function AdminNav({ groups, mode }: { groups: NavGroup[]; mode: "sidebar" | "drawer" }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (mode === "sidebar")
    return (
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-card px-3 py-5 lg:block">
        <NavLinks groups={groups} />
      </aside>
    );
  return (
    <>
      <button type="button" className="a-btn !px-2.5 lg:hidden" aria-expanded={open} aria-controls="admin-drawer" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <div id="admin-drawer" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-card px-3 py-4 shadow-[var(--shadow-lift)]">
            <div className="mb-4 flex justify-end">
              <button type="button" className="a-btn !px-2.5" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
