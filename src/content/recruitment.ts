/**
 * SAP recruitment & staffing content.
 * Services, SAP areas and the employer / candidate journeys all live here,
 * so copy changes never need a component edit.
 */
import { site } from "./site";

export const recruitmentPositioning = {
  eyebrow: "SAP Recruitment & Staffing · UK & Europe",
  title: "SAP Recruitment & SAP Staffing Solutions",
  summary: `As a specialist SAP recruitment partner, ${site.brand} finds contract and permanent SAP consultants for end customers and SAP service integrators across the UK and Europe.`,
  detail:
    "Our consultants specialise in SAP recruitment, so we understand the SAP modules, project types and roles that deliver successful implementations.",
  markets: "UK & Europe",
  audiences: ["End customers", "SAP service integrators"],
} as const;

export type RecruitmentIcon = "contract" | "permanent" | "project";

export type RecruitmentService = {
  slug: string;
  letter: string;
  title: string;
  /** One-line summary for cards and menus. */
  summary: string;
  intro: string;
  listTitle: string;
  items: string[];
  highlights: { title: string; text: string }[];
  icon: RecruitmentIcon;
  cta: { label: string; href: string };
};

export const recruitmentServices: RecruitmentService[] = [
  {
    slug: "contract-sap-recruitment",
    letter: "A",
    title: "Contract SAP Recruitment",
    summary: "Freelance SAP consultants from our international contractor pool, ready for project work.",
    intro:
      "Freelance SAP consultants from our international contractor pool, sourced quickly for implementations, transformation programmes and support work, for as long as the project needs them.",
    listTitle: "Contractors for",
    items: [
      "SAP implementations",
      "S/4HANA transformation projects",
      "SAP rollouts",
      "Post-go-live support",
      "Short-term and long-term project requirements",
    ],
    highlights: [
      { title: "Flexibility", text: "Scale SAP capacity up or down as project phases change." },
      { title: "Specialist expertise", text: "Consultants matched on module, project type and seniority." },
      { title: "Speed of sourcing", text: "Shortlists drawn from an established international contractor pool." },
    ],
    icon: "contract",
    cta: { label: "Hire SAP contractors", href: "/contact?service=contract-sap-recruitment" },
  },
  {
    slug: "permanent-sap-recruitment",
    letter: "B",
    title: "Permanent SAP Recruitment",
    summary: "Specialist permanent hires, matching the right SAP talent with the right organisation.",
    intro:
      "Permanent recruitment for specialist SAP positions. We take the time to understand your organisation, your SAP landscape and your team, so every shortlist is built around long-term fit as well as technical depth.",
    listTitle: "Permanent roles",
    items: [
      "SAP Consultants",
      "SAP Developers",
      "SAP Analysts",
      "SAP Solution Architects",
      "SAP Functional Leads",
      "SAP Project Managers",
    ],
    highlights: [
      { title: "Right talent", text: "Candidates assessed on SAP module depth and delivery experience." },
      { title: "Right organisation", text: "Shortlists shaped around your culture, team and growth plans." },
      { title: "Considered process", text: "Clear briefs, focused shortlists and support through to offer." },
    ],
    icon: "permanent",
    cta: { label: "Recruit permanent SAP staff", href: "/contact?service=permanent-sap-recruitment" },
  },
  {
    slug: "sap-project-staffing",
    letter: "C",
    title: "SAP Project Staffing",
    summary: "End-to-end staffing for complex, multi-phase SAP implementations.",
    intro:
      "End-to-end staffing support for complex, multi-phase SAP implementations. We can staff individual roles or build multi-disciplinary teams, and adjust the mix as the programme moves from one phase to the next.",
    listTitle: "Project types",
    items: [
      "Greenfield implementations",
      "Brownfield transformations",
      "Global and regional rollouts",
      "End-to-end SAP projects",
      "Multi-disciplinary project teams",
      "Post-implementation support",
    ],
    highlights: [
      { title: "Every phase", text: "Staffing from preparation and design through deployment and run." },
      { title: "Whole teams", text: "Functional, technical and project roles brought together." },
      { title: "One partner", text: "A single point of contact as requirements change." },
    ],
    icon: "project",
    cta: { label: "Discuss project staffing", href: "/contact?service=sap-project-staffing" },
  },
];

/** SAP Activate phases, used to show staffing support across a project. */
export const projectPhases = ["Prepare", "Explore", "Realise", "Deploy", "Run"] as const;

export type SapArea = { code: string; name: string };
export type SapAreaGroup = { id: string; title: string; text: string; icon: "platform" | "functional" | "analytics" | "infrastructure"; areas: SapArea[] };

export const sapAreaGroups: SapAreaGroup[] = [
  {
    id: "platforms",
    title: "SAP Platforms & Technologies",
    text: "Core platforms behind modern SAP landscapes.",
    icon: "platform",
    areas: [
      { code: "S/4HANA", name: "Next-generation ERP suite" },
      { code: "HANA", name: "In-memory database platform" },
      { code: "BTP", name: "Business Technology Platform" },
    ],
  },
  {
    id: "functional",
    title: "SAP Functional Modules",
    text: "Business process expertise across the SAP suite.",
    icon: "functional",
    areas: [
      { code: "FI/CO", name: "Finance & Controlling" },
      { code: "SD", name: "Sales & Distribution" },
      { code: "MM", name: "Materials Management" },
      { code: "PP", name: "Production Planning" },
      { code: "EWM", name: "Extended Warehouse Management" },
      { code: "HCM", name: "Human Capital Management" },
      { code: "CRM", name: "Customer Relationship Management" },
      { code: "SCM", name: "Supply Chain Management" },
      { code: "QM", name: "Quality Management" },
      { code: "PM", name: "Plant Maintenance" },
      { code: "PS", name: "Project System" },
    ],
  },
  {
    id: "analytics",
    title: "SAP Analytics & Development",
    text: "Reporting, custom development and user experience.",
    icon: "analytics",
    areas: [
      { code: "BI/BW", name: "Business Intelligence / Business Warehouse" },
      { code: "ABAP", name: "Custom development & enhancements" },
      { code: "Fiori/UI5", name: "User experience & front-end apps" },
    ],
  },
  {
    id: "infrastructure",
    title: "SAP Technical Infrastructure",
    text: "The technical foundation of every SAP system.",
    icon: "infrastructure",
    areas: [{ code: "Basis", name: "System administration, upgrades & landscape management" }],
  },
];

/** Every SAP area as a "SAP X" label, used by the CV form. */
export const sapSpecialisations = [
  ...sapAreaGroups.flatMap((g) => g.areas.map((a) => (a.code === "S/4HANA" ? "SAP S/4HANA" : `SAP ${a.code}`))),
  "SAP Project / Programme Management",
  "SAP Solution Architecture",
  "Other SAP area",
];

export const audiencePaths = {
  employers: {
    eyebrow: "For employers",
    title: "Hiring SAP talent?",
    text: "Tell us about your project or vacancy. We'll come back with a clear plan and relevant SAP profiles.",
    links: [
      { label: "Find SAP Talent", text: "Contract and permanent SAP consultants", href: "/contact?service=contract-sap-recruitment" },
      { label: "Discuss Staffing Requirements", text: "Teams for multi-phase SAP projects", href: "/contact?service=sap-project-staffing" },
      { label: "Contact Our Recruitment Team", text: "Speak to us directly", href: "/contact" },
    ],
  },
  candidates: {
    eyebrow: "For candidates",
    title: "Looking for your next SAP role?",
    text: "Share your profile once and we'll consider you for contract and permanent SAP opportunities that match your skills.",
    links: [
      { label: "Upload Your CV", text: "PDF or Word, takes two minutes", href: "/upload-cv" },
      { label: "Explore SAP Opportunities", text: "The SAP areas and roles we recruit for", href: "/sap-expertise#roles" },
      { label: "Submit Your Profile", text: "Contract, permanent or both", href: "/upload-cv#cv-form" },
    ],
  },
} as const;
