import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clients } from "@/content/clients";
import { audiencePaths, recruitmentServices, sapAreaGroups } from "@/content/recruitment";
import { candidateCta, footerQuickLinks, legalLinks, mainNav } from "@/content/site";
import { serviceOptions } from "@/lib/forms";

const root = path.resolve(__dirname, "..");
const pageExists = (href: string) => {
  const route = href.split(/[?#]/)[0];
  const file = route === "/" ? "src/app/page.tsx" : `src/app${route}/page.tsx`;
  return existsSync(path.join(root, file));
};

describe("navigation", () => {
  it("has the required main navigation items in order", () => {
    expect(mainNav.map((n) => n.label)).toEqual(["Home", "About Us", "Services", "SAP Expertise", "Our Clients", "Contact Us"]);
    expect(candidateCta.href).toBe("/upload-cv");
  });

  it("only links to pages that exist", () => {
    const hrefs = [
      ...mainNav.map((n) => n.href),
      candidateCta.href,
      ...footerQuickLinks.map((n) => n.href),
      ...legalLinks.map((n) => n.href),
      ...recruitmentServices.map((s) => s.cta.href),
      ...Object.values(audiencePaths).flatMap((p) => p.links.map((l) => l.href)),
    ];
    for (const href of hrefs) expect(pageExists(href), href).toBe(true);
  });
});

describe("recruitment content", () => {
  it("has the three services with unique slugs that the contact form recognises", () => {
    expect(recruitmentServices.map((s) => s.title)).toEqual(["Contract SAP Recruitment", "Permanent SAP Recruitment", "SAP Project Staffing"]);
    expect(new Set(recruitmentServices.map((s) => s.slug)).size).toBe(3);
    for (const s of recruitmentServices) expect(serviceOptions).toContain(s.title);
  });

  it("covers all 18 SAP areas", () => {
    expect(sapAreaGroups.flatMap((g) => g.areas).length).toBe(18);
  });
});

describe("clients data", () => {
  it("has unique names and every logo file exists", () => {
    expect(new Set(clients.map((c) => c.name)).size).toBe(clients.length);
    for (const c of clients) {
      expect(existsSync(path.join(root, "public", c.logo)), c.logo).toBe(true);
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });
});
