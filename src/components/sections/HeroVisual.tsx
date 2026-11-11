/**
 * Lightweight abstract visual for the homepage hero:
 * a hub (echoing the logo's triangle) connected to the capability areas,
 * with two small "system" cards. Pure SVG + CSS, no images or libraries.
 */

const nodes = [
  { label: "SAP", x: 50, y: 9, d: 500 },
  { label: "Java", x: 88, y: 31, d: 580 },
  { label: "Python", x: 88, y: 69, d: 660 },
  { label: "Cloud", x: 50, y: 91, d: 740 },
  { label: "APIs", x: 12, y: 69, d: 820 },
  { label: "Talent", x: 12, y: 31, d: 900 },
];

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]" aria-hidden>
      {/* soft glow */}
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(66,125,244,0.18),rgba(0,200,255,0.08)_45%,transparent_70%)]" />

      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id="hv-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#427DF4" />
            <stop offset="100%" stopColor="#00C8FF" />
          </linearGradient>
        </defs>
        {/* orbits */}
        <circle cx="50" cy="50" r="41" fill="none" stroke="#DCE6FD" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="#DCE6FD" strokeWidth="0.25" strokeDasharray="0.8 1.4" />
        <circle cx="50" cy="50" r="15" fill="none" stroke="#B9CDFB" strokeWidth="0.25" />
        {/* hexagon outline joining the nodes */}
        <polygon
          points={nodes.map((n) => `${n.x},${n.y}`).join(" ")}
          fill="none"
          stroke="#DCE6FD"
          strokeWidth="0.3"
          className="anim-draw"
          style={{ ["--len" as string]: 260, ["--d" as string]: "700ms" }}
          pathLength={260}
        />
        {/* spokes */}
        {nodes.map((n) => (
          <line
            key={n.label}
            x1="50"
            y1="50"
            x2={n.x}
            y2={n.y}
            stroke="url(#hv-line)"
            strokeWidth="0.45"
            strokeLinecap="round"
            pathLength={100}
            className="anim-draw"
            style={{ ["--len" as string]: 100, ["--d" as string]: `${n.d - 300}ms` }}
          />
        ))}
        {/* data points on spokes */}
        {nodes.map((n, i) => (
          <circle
            key={`p-${n.label}`}
            cx={50 + (n.x - 50) * 0.55}
            cy={50 + (n.y - 50) * 0.55}
            r="0.9"
            fill={i % 2 ? "#00C8FF" : "#427DF4"}
            className="anim-fade-in"
            style={{ ["--d" as string]: `${n.d + 300}ms` }}
          />
        ))}
      </svg>

      {/* hub */}
      <div
        className="anim-pop absolute left-1/2 top-1/2 grid size-[26%] place-items-center rounded-[22%] border border-brand-100 bg-white shadow-[0_20px_50px_-20px_rgba(31,79,184,0.45)]"
        style={{ ["--d" as string]: "150ms" }}
      >
        <svg viewBox="0 0 60 52" className="w-[52%]">
          <path d="M30 2 58 50H2Z" fill="#00C8FF" />
          <path d="M30 22 41 41H19Z" fill="#fff" />
          <path d="M14 46c14-2 28-9 40-24-6 11-19 21-40 26Z" fill="#FF4E3E" />
        </svg>
      </div>

      {/* nodes */}
      {nodes.map((n) => (
        <div
          key={n.label}
          className="anim-pop absolute left-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-ink shadow-[0_8px_20px_-12px_rgba(15,27,51,0.35)] sm:text-xs"
          style={{ left: `${n.x}%`, top: `${n.y}%`, ["--d" as string]: `${n.d}ms` }}
        >
          <span className="size-1.5 rounded-full bg-gradient-to-br from-brand-500 to-sky-brand" />
          {n.label}
        </div>
      ))}

      {/* system cards */}
      <div
        className="anim-fade-up absolute -left-2 top-[40%] hidden w-44 rounded-xl border border-line bg-white/95 p-3 shadow-[0_16px_40px_-20px_rgba(15,27,51,0.35)] backdrop-blur sm:block lg:-left-8"
        style={{ ["--d" as string]: "1100ms" }}
      >
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">Delivery</p>
        <ul className="mt-2 space-y-1.5">
          {["Understand", "Strategize", "Deliver", "Support"].map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-[0.7rem] text-ink-soft">
              <span className={`grid size-3.5 place-items-center rounded-full ${i < 3 ? "bg-brand-500" : "border border-brand-300"}`}>
                {i < 3 && (
                  <svg viewBox="0 0 12 12" className="size-2.5 text-white">
                    <path d="m3 6.2 2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="anim-fade-up absolute -right-2 bottom-[12%] hidden w-48 rounded-xl border border-line bg-white/95 p-3 shadow-[0_16px_40px_-20px_rgba(15,27,51,0.35)] backdrop-blur sm:block lg:-right-6"
        style={{ ["--d" as string]: "1250ms" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">Integration</p>
          <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
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
  );
}
