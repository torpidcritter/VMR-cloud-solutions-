import type { MetadataRoute } from "next";
import { services } from "@/content/services";
import { site } from "@/content/site";
import { listPublicOpenings } from "@/lib/data/openings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await listPublicOpenings();
  const now = new Date();
  const pages = [
    "",
    "/about",
    "/services",
    "/sap-expertise",
    "/clients",
    "/upload-cv",
    "/technology",
    "/industries",
    "/careers",
    "/contact",
    "/privacy-policy",
    "/terms",
    "/cookie-policy",
  ];
  return [
    ...pages.map((p) => ({
      url: `${site.url}${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 1 : p.includes("policy") || p === "/terms" ? 0.3 : 0.8,
    })),
    ...services.map((s) => ({
      url: `${site.url}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...jobs.map((j) => ({
      url: `${site.url}/careers/${j.slug}`,
      lastModified: new Date(j.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
