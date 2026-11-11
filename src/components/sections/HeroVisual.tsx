/**
 * Lightweight abstract visual for the homepage hero:
 * the animated orbit with two gently floating "system" cards. Pure CSS.
 */

import { OrbitVisual } from "./OrbitVisual";

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]" aria-hidden>
      <OrbitVisual
        items={["SAP", "Java", "Python", "Cloud", "APIs", "Talent"]}
        speed={60}
      />

      {/* system cards */}
      <div
        className="anim-fade-up absolute -left-2 top-[40%] hidden w-44 sm:block lg:-left-8"
        style={{ ["--d" as string]: "1100ms" }}
      >
        <div className="o-float relative z-10 rounded-xl border border-line bg-card p-3 shadow-[0_16px_40px_-20px_rgba(15,27,51,0.35)] backdrop-blur">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            Delivery
          </p>
          <ul className="mt-2 space-y-1.5">
            {["Understand", "Strategize", "Deliver", "Support"].map((s, i) => (
              <li
                key={s}
                className="flex items-center gap-2 text-[0.7rem] text-ink-soft"
              >
                <span
                  className={`grid size-3.5 place-items-center rounded-full ${i < 3 ? "bg-brand-500" : "border border-brand-300"}`}
                >
                  {i < 3 && (
                    <svg viewBox="0 0 12 12" className="size-2.5 text-white">
                      <path
                        d="m3 6.2 2 2 4-4.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="anim-fade-up absolute -right-2 bottom-[12%] hidden w-48 sm:block lg:-right-6"
        style={{ ["--d" as string]: "1250ms" }}
      >
        <div className="o-float relative z-10 rounded-xl border border-line bg-card p-3 shadow-[0_16px_40px_-20px_rgba(15,27,51,0.35)] backdrop-blur" style={{ ["--d" as string]: "-3s" }}>
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
              Integration
            </p>
            <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />{" "}
              Connected
            </span>
          </div>
          <div className="mt-3 flex h-10 items-end gap-1">
            {[40, 62, 48, 75, 58, 88, 70, 95].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-brand-500 to-sky-brand"
                style={{ height: `${h}%`, opacity: 0.35 + i * 0.08 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
