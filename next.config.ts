import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Content-Security-Policy. Next.js inlines small scripts for hydration, so
 * scripts allow 'unsafe-inline' but only from this site; nothing loads from
 * other origins except the Google Maps embed on the contact page. The dev
 * server also needs eval for fast refresh; Vercel preview deployments load
 * their feedback toolbar from vercel.live.
 */
const dev = process.env.NODE_ENV !== "production";
const preview = process.env.VERCEL_ENV === "preview";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${preview ? " https://vercel.live" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src https://www.google.com https://maps.google.com${preview ? " https://vercel.live" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The embedded Postgres used for local development loads its own WebAssembly files.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: { formats: ["image/avif", "image/webp"] },
  // Admins upload resumes (up to 4 MB) through server actions; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages only: file and JSON routes (resume preview, CSV, ZIP) don't run scripts, and a PDF
      // opened in the browser's viewer must not be blocked by object-src.
      { source: "/((?!api/|admin/api/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
      // The admin panel never belongs in search results, including its file and CSV routes.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
