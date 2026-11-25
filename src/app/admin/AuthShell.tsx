import Image from "next/image";
import type { ReactNode } from "react";

/** Centred card used by sign-in, setup and password pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div aria-hidden className="bg-grid mask-radial absolute inset-0" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/brand/vmr-cloud-logo.png" alt="VMR Cloud Solutions" width={624} height={115} priority className="h-11 w-auto" />
        </div>
        <div className="card p-7 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">VMR Cloud Solutions · Admin panel · Authorised staff only</p>
      </div>
    </main>
  );
}
