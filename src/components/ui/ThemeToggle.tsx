"use client";

import { Moon, Sun } from "lucide-react";

/** Switches between light and dark themes and remembers the choice. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a1226" : "#ffffff");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className={`inline-grid size-11 place-items-center rounded-full border border-line bg-card text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700 ${className}`}
    >
      <Moon aria-hidden className="size-[1.15rem] dark:hidden" />
      <Sun aria-hidden className="hidden size-[1.15rem] dark:block" />
    </button>
  );
}
