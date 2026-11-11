import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RevealObserver } from "@/components/ui/RevealObserver";
import { organizationJsonLd } from "@/lib/seo";
import { site } from "@/content/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | SAP Recruitment & SAP Staffing Solutions`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "VMR Cloud Solutions",
    "SAP recruitment",
    "SAP recruitment agency",
    "SAP staffing",
    "contract SAP recruitment",
    "permanent SAP recruitment",
    "SAP project staffing",
    "SAP contractors UK",
    "SAP consultants Europe",
    "S/4HANA recruitment",
    "IT consulting Bengaluru",
    "SAP consulting",
    "Java development",
    "Python development",
    "digital transformation",
    "IT staffing",
    "enterprise software development",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    url: "/",
    title: `${site.name} | SAP Recruitment & SAP Staffing Solutions`,
    description: site.description,
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: site.name }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#0a1226")}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved or system theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-page">
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <RevealObserver />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
      </body>
    </html>
  );
}
