/**
 * Admin roles and what each may do. Checked on the server for every page,
 * action and download; the UI only hides what the server would refuse.
 */

export const ROLES = ["super_admin", "recruiter", "sales", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  recruiter: "Recruiter / HR",
  sales: "Sales (SAP Practice)",
  viewer: "Viewer",
};

export type Permission =
  | "dashboard.view"
  | "openings.view"
  | "openings.edit"
  | "openings.delete"
  | "openings.viewClient"
  | "candidates.edit"
  | "candidates.merge"
  | "interviews.manage"
  | "talent.manage"
  | "clients.view"
  | "clients.edit"
  | "clients.delete"
  | "email.send"
  | "applications.view"
  | "applications.update"
  | "applications.delete"
  | "applications.export"
  | "resumes.download"
  | "enquiries.view"
  | "enquiries.update"
  | "users.manage"
  | "settings.manage"
  | "activity.view";

const ALL: Permission[] = [
  "dashboard.view",
  "openings.view",
  "openings.edit",
  "openings.delete",
  "openings.viewClient",
  "candidates.edit",
  "candidates.merge",
  "interviews.manage",
  "talent.manage",
  "clients.view",
  "clients.edit",
  "clients.delete",
  "email.send",
  "applications.view",
  "applications.update",
  "applications.delete",
  "applications.export",
  "resumes.download",
  "enquiries.view",
  "enquiries.update",
  "users.manage",
  "settings.manage",
  "activity.view",
];

const GRANTS: Record<Role, Permission[]> = {
  super_admin: ALL,
  recruiter: [
    "dashboard.view",
    "openings.view",
    "openings.edit",
    "openings.viewClient",
    "candidates.edit",
    "interviews.manage",
    "talent.manage",
    "clients.view",
    "clients.edit",
    "email.send",
    "applications.view",
    "applications.update",
    "applications.export",
    "resumes.download",
    "enquiries.view",
  ],
  sales: ["dashboard.view", "openings.view", "clients.view", "clients.edit", "applications.view", "resumes.download", "enquiries.view", "enquiries.update"],
  viewer: ["dashboard.view", "openings.view", "applications.view", "enquiries.view"],
};

export function can(role: Role | string | null | undefined, permission: Permission) {
  if (!role || !(role in GRANTS)) return false;
  return GRANTS[role as Role].includes(permission);
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
