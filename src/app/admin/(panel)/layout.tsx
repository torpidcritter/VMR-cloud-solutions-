import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { signOutAction } from "../actions/auth";

const NAV: (NavItem & { perm: Permission })[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", perm: "dashboard.view" },
  { href: "/admin/openings", label: "Job Openings", icon: "openings", perm: "openings.view" },
  { href: "/admin/applications", label: "Applications", icon: "applications", perm: "applications.view" },
  { href: "/admin/talent", label: "Talent Bank", icon: "talent", perm: "applications.view" },
  { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", perm: "enquiries.view" },
  { href: "/admin/users", label: "Users", icon: "users", perm: "users.manage" },
  { href: "/admin/activity", label: "Activity", icon: "activity", perm: "activity.view" },
  { href: "/admin/settings", label: "Settings", icon: "settings", perm: "settings.manage" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  if (me.mustChangePassword) redirect("/admin/change-password");
  const items: NavItem[] = NAV.filter((n) => can(me.role, n.perm)).map((n) => ({ href: n.href, label: n.label, icon: n.icon }));
  const initials = me.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5" aria-label="Admin dashboard">
            <Image src="/brand/vmr-cloud-logo.png" alt="" width={624} height={115} className="h-8 w-auto" priority />
            <span className="hidden rounded-md bg-brand-50 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-brand-600 sm:inline xl:hidden 2xl:inline">Admin</span>
          </Link>
          <AdminNav items={items} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="!size-9" />
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 hover:border-brand-300 [&::-webkit-details-marker]:hidden">
                <span className="grid size-7 place-items-center rounded-full bg-btn text-xs font-bold text-white">{initials}</span>
                <span className="hidden max-w-32 truncate text-sm font-medium sm:inline xl:hidden 2xl:inline">{me.name}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-card p-2 shadow-[var(--shadow-lift)]">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{me.name}</p>
                  <p className="truncate text-xs text-muted">{me.email}</p>
                  <p className="mt-1 text-xs font-medium text-brand-600">{ROLE_LABELS[me.role]}</p>
                </div>
                <a href="/" target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm hover:bg-surface">
                  View website
                </a>
                <Link href="/admin/change-password" className="block rounded-lg px-3 py-2 text-sm hover:bg-surface">
                  Change password
                </Link>
                <form action={signOutAction}>
                  <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-accent-600 hover:bg-surface">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6">{children}</main>
    </>
  );
}
