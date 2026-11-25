"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, BriefcaseBusiness, FileText, LayoutDashboard, Menu, MessageSquare, Settings, UserCog, Users, X } from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  openings: BriefcaseBusiness,
  applications: FileText,
  talent: Users,
  enquiries: MessageSquare,
  users: UserCog,
  activity: Activity,
  settings: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

/** Top navigation; collapses into a menu on small screens. */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const link = (n: NavItem, mobile = false) => {
    const Icon = ICONS[n.icon];
    const on = active(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setOpen(false)}
        aria-current={on ? "page" : undefined}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
          on ? "bg-brand-50 text-brand-600" : "text-ink-soft hover:bg-surface hover:text-ink"
        } ${mobile ? "w-full" : ""}`}
      >
        <Icon aria-hidden className="size-4" />
        {n.label}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Admin" className="hidden items-center gap-0.5 xl:flex">
        {items.map((n) => link(n))}
      </nav>
      <button type="button" className="a-btn !px-2.5 xl:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      {open && (
        <nav aria-label="Admin" className="absolute inset-x-0 top-16 grid gap-1 border-b border-line bg-card p-3 shadow-[var(--shadow-lift)] sm:grid-cols-2 xl:hidden">
          {items.map((n) => link(n, true))}
        </nav>
      )}
    </>
  );
}
