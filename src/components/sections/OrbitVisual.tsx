import type { CSSProperties } from "react";

/**
 * Animated "orbit" visual used on the right of page headers and on the homepage.
 * Pure CSS (transforms + opacity only), so it stays light and runs on the GPU.
 * Labels orbit the hub slowly while staying upright, data packets travel
 * out along the spokes, a radar sweep turns and rings pulse from the centre.
 * Everything stops when the visitor prefers reduced motion.
 */

type Props = {
  items: readonly string[];
  className?: string;
  /** Seconds for one full orbit of the labels. */
  speed?: number;
};

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export function OrbitVisual({ items, className = "", speed = 70 }: Props) {
  const n = items.length;
  return (
    <div
      aria-hidden
      className={`orbit relative mx-auto aspect-square w-full select-none ${className}`}
      style={{ containerType: "inline-size" }}
    >
      {/* soft glow */}
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,rgba(66,125,244,0.2),rgba(0,200,255,0.08)_45%,transparent_70%)]" />

      {/* outer dashed ring, slowly turning, with two satellites */}
      <div className="o-spin absolute inset-[3%] rounded-full border border-dashed border-brand-200" style={v({ "--t": "120s" })}>
        <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(66,125,244,0.8)]" />
        <span className="absolute bottom-[14.6%] right-[14.6%] size-1.5 translate-x-1/2 translate-y-1/2 rounded-full bg-sky-brand shadow-[0_0_10px_rgba(0,200,255,0.8)]" />
      </div>

      {/* radar sweep */}
      <div
        className="o-spin absolute inset-[3%] rounded-full bg-[conic-gradient(from_0deg,transparent_72%,rgba(0,200,255,0.05)_85%,rgba(66,125,244,0.2)_99.6%,transparent_100%)] [mask-image:radial-gradient(circle,transparent_18%,#000_19%)]"
        style={v({ "--t": "9s" })}
      />

      {/* middle ring, counter-rotating */}
      <div className="o-spin-rev absolute inset-[22%] rounded-full border border-brand-100" style={v({ "--t": "45s" })}>
        <span className="absolute left-0 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-brand" />
        <span className="absolute right-0 top-1/2 size-1 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500" />
      </div>

      {/* pulses from the hub */}
      {[0, 2, 4].map((d) => (
        <div
          key={d}
          className="o-ping absolute inset-[18%] rounded-full border border-brand-300/60"
          style={v({ "--d": `${d}s` })}
        />
      ))}

      {/* spokes + labels, orbiting together */}
      <div className="o-spin absolute inset-0" style={v({ "--t": `${speed}s` })}>
        {items.map((label, i) => {
          const a = -90 + (360 / n) * i;
          return (
            <div key={label}>
              {/* spoke with a travelling data packet */}
              <div
                className="absolute left-1/2 top-1/2 h-px origin-left bg-gradient-to-r from-brand-300/70 via-brand-200/60 to-transparent"
                style={{ width: "38cqw", transform: `rotate(${a}deg)` }}
              >
                <div className="o-travel absolute inset-0" style={v({ "--d": `${(i * 3.2) / n}s` })}>
                  <span className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-sky-brand shadow-[0_0_10px_2px_rgba(0,200,255,0.55)]" />
                </div>
              </div>
              {/* label, kept upright while orbiting */}
              <div
                className="absolute left-1/2 top-1/2 size-0"
                style={{ transform: `rotate(${a}deg) translateX(38cqw) rotate(${-a}deg)` }}
              >
                <div className="o-spin-rev size-0" style={v({ "--t": `${speed}s` })}>
                  <span
                    className="anim-fade-in absolute left-0 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink shadow-[0_10px_24px_-14px_rgba(15,27,51,0.45)]"
                    style={v({ "--d": `${300 + i * 110}ms` })}
                  >
                    <span className="o-blink size-1.5 rounded-full bg-gradient-to-br from-brand-500 to-sky-brand" style={v({ "--d": `${i * 0.45}s` })} />
                    {label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* hub with the logo mark */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="o-breathe grid size-[24%] place-items-center rounded-[24%] border border-brand-100 bg-card shadow-[0_24px_60px_-22px_rgba(31,79,184,0.55)]">
          <div className="absolute inset-0 rounded-[24%] bg-[radial-gradient(circle_at_30%_20%,rgba(0,200,255,0.12),transparent_60%)]" />
          <svg viewBox="0 0 60 52" className="relative w-[52%]">
            <path d="M30 2 58 50H2Z" fill="#00C8FF" />
            <path d="M30 22 41 41H19Z" className="fill-card" />
            <path d="M14 46c14-2 28-9 40-24-6 11-19 21-40 26Z" fill="#FF4E3E" />
          </svg>
        </div>
      </div>
    </div>
  );
}
