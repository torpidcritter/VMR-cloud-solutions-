"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" };

/** Shows a short message in the corner. Callable from any client component. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  window.dispatchEvent(new CustomEvent("vmr-toast", { detail: { message, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { message, tone } = (e as CustomEvent<{ message: string; tone: Toast["tone"] }>).detail;
      const id = ++n;
      setItems((list) => [...list.slice(-3), { id, message, tone }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
    };
    window.addEventListener("vmr-toast", onToast);
    return () => window.removeEventListener("vmr-toast", onToast);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="anim-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-card p-3.5 text-sm shadow-[var(--shadow-lift)]"
        >
          {t.tone === "error" ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-600" /> : <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
          <span className="flex-1 text-ink">{t.message}</span>
          <button type="button" aria-label="Dismiss" className="text-muted hover:text-ink" onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
