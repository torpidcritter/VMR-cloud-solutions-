"use client";

import { useEffect, useRef } from "react";

/**
 * Rotating 3D dot globe with glowing data arcs and technology labels
 * that ride on its surface. Drawn on a single canvas (no libraries),
 * paused while off screen, and shown as a still frame when the visitor
 * prefers reduced motion.
 */

type V3 = [number, number, number];

const DOTS = 1100;
const TILT = 0.38;

function fibonacciSphere(n: number): V3[] {
  const pts: V3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = g * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return pts;
}

function fromLatLon(lat: number, lon: number): V3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

function slerp(a: V3, b: V3, t: number): V3 {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const w = Math.acos(d);
  if (w < 1e-4) return a;
  const s = Math.sin(w);
  const k1 = Math.sin((1 - t) * w) / s;
  const k2 = Math.sin(t * w) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

const labelSpots: [number, number][] = [
  [38, 20],
  [-12, 80],
  [22, 150],
  [-30, 210],
  [48, 260],
  [-5, 320],
  [10, 0],
];

type Arc = { a: V3; b: V3; t: number; speed: number; hue: string };

export function GlobeVisual({
  items = ["SAP", "Java", "Python", "Cloud", "APIs", "Data"],
  className = "",
}: {
  items?: readonly string[];
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const dots = fibonacciSphere(DOTS);
    const labels = items.map((text, i) => ({ text, p: fromLatLon(...labelSpots[i % labelSpots.length]) }));
    const arcs: Arc[] = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let size = 0;
    let dpr = 1;
    let rot = 0.6;
    let raf = 0;
    let last = performance.now();
    let spawnIn = 0;
    let visible = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = c.clientWidth;
      c.width = size * dpr;
      c.height = size * dpr;
    };

    const project = (p: V3): V3 => {
      // spin around Y, then tilt around X
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      const x = p[0] * cr - p[2] * sr;
      const z1 = p[0] * sr + p[2] * cr;
      const ct = Math.cos(TILT);
      const st = Math.sin(TILT);
      const y = p[1] * ct - z1 * st;
      const z = p[1] * st + z1 * ct;
      return [x, y, z];
    };

    const spawn = () => {
      const a = dots[(Math.random() * DOTS) | 0];
      let b = dots[(Math.random() * DOTS) | 0];
      for (let k = 0; k < 6 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0.2; k++) b = dots[(Math.random() * DOTS) | 0];
      arcs.push({ a, b, t: 0, speed: 0.28 + Math.random() * 0.2, hue: Math.random() < 0.25 ? "255,78,62" : "0,200,255" });
    };

    const draw = (dt: number) => {
      const dark = document.documentElement.classList.contains("dark");
      const R = size * 0.4;
      const cx = size / 2;
      const cy = size / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // dots
      for (let i = 0; i < DOTS; i++) {
        const [x, y, z] = project(dots[i]);
        const depth = (z + 1) / 2; // 0 back, 1 front
        const a = z < 0 ? 0.05 + depth * 0.25 : 0.25 + depth * 0.7;
        const r = 0.55 + depth * 1.05;
        ctx.fillStyle = i % 9 === 0 ? `rgba(0,200,255,${a})` : dark ? `rgba(126,165,255,${a})` : `rgba(42,99,219,${a})`;
        ctx.beginPath();
        ctx.arc(cx + x * R, cy - y * R, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // arcs
      if (!reduce) {
        spawnIn -= dt;
        if (spawnIn <= 0 && arcs.length < 7) {
          spawn();
          spawnIn = 0.45 + Math.random() * 0.5;
        }
      } else if (arcs.length === 0) {
        for (let k = 0; k < 5; k++) {
          spawn();
          arcs[k].t = 0.7;
        }
      }
      ctx.lineCap = "round";
      for (let k = arcs.length - 1; k >= 0; k--) {
        const arc = arcs[k];
        if (!reduce) arc.t += dt * arc.speed;
        if (arc.t > 1.6) {
          arcs.splice(k, 1);
          continue;
        }
        const head = Math.min(arc.t, 1);
        const tail = Math.max(0, arc.t - 0.6);
        const steps = 28;
        let prev: V3 | null = null;
        for (let s = 0; s <= steps; s++) {
          const u = tail + ((head - tail) * s) / steps;
          const p = slerp(arc.a, arc.b, u);
          const lift = 1 + 0.28 * Math.sin(Math.PI * u);
          const q = project([p[0] * lift, p[1] * lift, p[2] * lift]);
          if (prev) {
            const fade = s / steps;
            const front = q[2] > -0.15 ? 1 : 0.18;
            ctx.strokeStyle = `rgba(${arc.hue},${0.85 * fade * front})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx + prev[0] * R, cy - prev[1] * R);
            ctx.lineTo(cx + q[0] * R, cy - q[1] * R);
            ctx.stroke();
          }
          prev = q;
        }
        if (prev && arc.t < 1 && prev[2] > -0.15) {
          const hx = cx + prev[0] * R;
          const hy = cy - prev[1] * R;
          const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 9);
          glow.addColorStop(0, `rgba(${arc.hue},0.9)`);
          glow.addColorStop(1, `rgba(${arc.hue},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(hx, hy, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // labels riding on the surface
      ctx.font = `600 ${Math.max(11, size * 0.026)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      for (const l of labels) {
        const [x, y, z] = project(l.p);
        if (z < -0.05) continue;
        const alpha = Math.min(1, (z + 0.05) * 3);
        const px = cx + x * R * 1.08;
        const py = cy - y * R * 1.08;
        const tw = ctx.measureText(l.text).width;
        const ph = size * 0.058;
        const pw = tw + ph * 1.35;
        ctx.globalAlpha = alpha;
        // anchor dot + stem
        ctx.fillStyle = "#00C8FF";
        ctx.beginPath();
        ctx.arc(cx + x * R, cy - y * R, 2.6, 0, Math.PI * 2);
        ctx.fill();
        // pill
        ctx.fillStyle = dark ? "rgba(16,27,54,0.92)" : "rgba(255,255,255,0.95)";
        ctx.strokeStyle = dark ? "rgba(126,165,255,0.35)" : "rgba(66,125,244,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px - pw / 2, py - ph / 2 - ph * 0.9, pw, ph, ph / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#00C8FF";
        ctx.beginPath();
        ctx.arc(px - pw / 2 + ph * 0.45, py - ph * 0.9, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark ? "#e9eef8" : "#0f1b33";
        ctx.fillText(l.text, px - pw / 2 + ph * 0.75, py - ph * 0.9 + 0.5);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rot += dt * 0.16;
      draw(dt);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(c);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(c);

    const mo = new MutationObserver(() => reduce && draw(0));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [items]);

  return (
    <div aria-hidden className={`relative mx-auto aspect-square w-full select-none ${className}`}>
      {/* atmosphere glow */}
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(66,125,244,0.16)_0%,rgba(0,200,255,0.1)_45%,transparent_68%)]" />
      <div className="absolute inset-[9%] rounded-full shadow-[0_0_80px_10px_rgba(66,125,244,0.12)]" />
      <canvas ref={canvas} className="anim-fade-in relative size-full" />
    </div>
  );
}
