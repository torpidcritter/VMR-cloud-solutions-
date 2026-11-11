import type { Metadata } from "next";
import { site } from "@/content/site";

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      url: path,
      siteName: site.name,
      type: "website",
      locale: "en_IN",
      images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: site.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${site.name}`,
      description,
      images: ["/brand/og-image.png"],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.legalName,
    alternateName: [site.name, site.brand],
    url: site.url,
    logo: `${site.url}/brand/vmr-cloud-logo.png`,
    foundingDate: "2017-09-07",
    slogan: site.tagline,
    description: site.description,
    email: site.email.general,
    telephone: "+91-9392670130",
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    location: site.offices.map((o) => ({
      "@type": "Place",
      name: `${site.legalName} – ${o.name}`,
      address: { "@type": "PostalAddress", streetAddress: o.lines.slice(0, -1).join(", "), addressRegion: o.city.split(", ")[1], addressCountry: "IN" },
    })),
    contactPoint: [
      { "@type": "ContactPoint", contactType: "sales", email: site.email.general, telephone: "+91-9392670130", areaServed: "IN" },
      { "@type": "ContactPoint", contactType: "human resources", email: site.email.hr },
    ],
    sameAs: Object.values(site.social).filter(Boolean),
  };
}
