"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { serviceIcons } from "@/components/ui/icons";
import { recruitmentIcons } from "@/components/sections/recruitment";
import { recruitmentServices } from "@/content/recruitment";
import { candidateCta, mainNav, site } from "@/content/site";
import { services } from "@/content/services";

const DARK_HERO_PATHS = ["/clients"];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // services dropdown (desktop)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
    setMobileServicesOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mobileOpen]);

  // Escape closes any open menu; clicking outside closes the dropdown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
      setMobileOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  const openMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }, []);
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenuOpen(false), 140);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const solid = scrolled || mobileOpen || menuOpen;
  /** Pages whose hero is dark navy: use light nav text while the header is transparent. */
  const overDark = !solid && DARK_HERO_PATHS.includes(pathname);

  return (
    <>
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        solid
          ? "border-b border-line bg-card/90 shadow-[0_6px_24px_-18px_rgba(15,27,51,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-card/80"
          : "border-b border-transparent bg-card/0"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <div className="header-x flex h-[var(--header-h)] items-center justify-between gap-6">
        <Logo priority />

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) =>
              "hasMenu" in item && item.hasMenu ? (
                <li key={item.href} className="relative" ref={menuRef} onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
                  <button
                    ref={triggerRef}
                    type="button"
                    aria-expanded={menuOpen}
                    aria-controls="services-menu"
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`group relative inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.925rem] font-medium 2xl:px-4 transition-colors ${
                      isActive(item.href) ? (overDark ? "text-white" : "text-brand-700") : overDark ? "text-slate-300 hover:text-white" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {item.label}
                    <ChevronDown
                      aria-hidden
                      className={`size-4 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                    />
                    {isActive(item.href) && <ActiveDot />}
                  </button>

                  <div
                    id="services-menu"
                    className={`absolute left-1/2 top-full w-[min(46rem,calc(100vw-4rem))] -translate-x-1/2 pt-3 transition-[opacity,transform,visibility] duration-200 ${
                      menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_60px_-24px_rgba(15,27,51,0.35)]">
                      <div className="grid grid-cols-[1.15fr_1fr]">
                        <div className="p-3">
                          <p className="px-3 pb-2 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">SAP Recruitment &amp; Staffing</p>
                          <ul className="space-y-1">
                            {recruitmentServices.map((s) => {
                              const Icon = recruitmentIcons[s.icon];
                              return (
                                <li key={s.slug}>
                                  <Link href={`/services#${s.slug}`} onClick={() => setMenuOpen(false)} className="group/item flex gap-3 rounded-xl p-3 transition-colors hover:bg-surface">
                                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-card text-brand-600 transition-colors group-hover/item:border-brand-200 group-hover/item:text-brand-700">
                                      <Icon aria-hidden className="size-[1.1rem]" strokeWidth={1.75} />
                                    </span>
                                    <span>
                                      <span className="block text-sm font-semibold text-ink">{s.title}</span>
                                      <span className="mt-0.5 line-clamp-2 block text-[0.8rem] leading-snug text-muted">{s.summary}</span>
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="border-l border-line bg-surface/60 p-3">
                          <p className="px-3 pb-2 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">Technology Services</p>
                          <ul>
                            {services.map((s) => {
                              const Icon = serviceIcons[s.icon];
                              const active = pathname === `/services/${s.slug}`;
                              return (
                                <li key={s.slug}>
                                  <Link
                                    href={`/services/${s.slug}`}
                                    aria-current={active ? "page" : undefined}
                                    className={`group/item flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink ${active ? "bg-card text-brand-700" : ""}`}
                                  >
                                    <Icon aria-hidden className="size-4 shrink-0 text-brand-600" strokeWidth={1.75} />
                                    {s.navTitle}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-line bg-surface px-6 py-3.5">
                        <p className="text-sm text-muted">Contract · Permanent · Project staffing</p>
                        <div className="flex items-center gap-5">
                          <Link href="/sap-expertise" className="link-arrow text-sm">
                            SAP areas we recruit for
                          </Link>
                          <Link href="/services" className="link-arrow text-sm">
                            All services <ArrowRight aria-hidden className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`relative inline-flex rounded-full px-3 py-2 text-[0.925rem] font-medium 2xl:px-4 transition-colors ${
                      isActive(item.href) ? (overDark ? "text-white" : "text-brand-700") : overDark ? "text-slate-300 hover:text-white" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {item.label}
                    {isActive(item.href) && <ActiveDot />}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={candidateCta.href}
            aria-current={pathname === candidateCta.href ? "page" : undefined}
            className="btn btn-primary hidden !min-h-[2.6rem] !px-5 !text-sm xl:inline-flex"
          >
            {candidateCta.label}
          </Link>
          <button
            type="button"
            className="inline-grid size-11 place-items-center rounded-full border border-line bg-card text-ink xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>

    </header>
      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 origin-top overflow-y-auto border-t border-line bg-card transition-[opacity,transform,visibility] duration-250 xl:hidden ${
          mobileOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
      >
        <nav aria-label="Mobile" className="container-x flex min-h-full flex-col py-4">
          <ul className="divide-y divide-line">
            {mainNav.map((item) =>
              "hasMenu" in item && item.hasMenu ? (
                <li key={item.href}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-4 text-left text-lg font-semibold text-ink"
                    aria-expanded={mobileServicesOpen}
                    aria-controls="mobile-services"
                    onClick={() => setMobileServicesOpen((v) => !v)}
                  >
                    {item.label}
                    <ChevronDown aria-hidden className={`size-5 text-muted transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div
                    id="mobile-services"
                    className={`grid transition-[grid-template-rows] duration-300 ${mobileServicesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <ul className="overflow-hidden">
                      <li>
                        <Link href="/services" className="block rounded-lg px-3 py-2.5 text-[0.95rem] font-medium text-brand-700">
                          All services
                        </Link>
                      </li>
                      <li className="px-3 pb-1 pt-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">SAP Recruitment &amp; Staffing</li>
                      {recruitmentServices.map((s) => (
                        <li key={s.slug}>
                          <Link
                            href={`/services#${s.slug}`}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] text-ink-soft hover:bg-surface"
                          >
                            <span className="w-6 text-xs font-semibold text-muted">{s.letter}</span>
                            {s.title}
                          </Link>
                        </li>
                      ))}
                      <li className="px-3 pb-1 pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">Technology Services</li>
                      {services.map((s) => (
                        <li key={s.slug}>
                          <Link
                            href={`/services/${s.slug}`}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] text-ink-soft hover:bg-surface"
                          >
                            <span className="w-6 text-xs font-semibold text-muted">{s.number}</span>
                            {s.navTitle}
                          </Link>
                        </li>
                      ))}
                      <li className="pb-3">
                        <Link href="/technology" className="block rounded-lg px-3 py-2.5 text-[0.95rem] text-ink-soft hover:bg-surface">
                          Technology Expertise
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`block py-4 text-lg font-semibold ${isActive(item.href) ? "text-brand-700" : "text-ink"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <div className="mt-auto space-y-3 pt-8">
            <Link href={candidateCta.href} className="btn btn-primary w-full">
              {candidateCta.label} <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/contact?service=contract-sap-recruitment" className="btn btn-secondary w-full">
              Find SAP Talent <ArrowRight aria-hidden className="size-4" />
            </Link>
            <a href={site.phone.mobile.href} className="btn btn-secondary w-full">
              Call {site.phone.mobile.display}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}

function ActiveDot() {
  return (
    <span aria-hidden className="absolute bottom-0.5 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent-500 to-brand-500" />
  );
}
