import "server-only";
import { db, isDbConfigured } from "@/lib/db/client";
import { site } from "@/content/site";

/** Admin-editable settings, with safe defaults when nothing is saved yet. */
export type Settings = {
  /** Where job applications and CV uploads are emailed. */
  applicationsEmail: string;
  /** Where contact-form enquiries are emailed. */
  enquiriesEmail: string;
  /** Send an email for each new application / enquiry. */
  notifyApplications: boolean;
  notifyEnquiries: boolean;
  /** Show the fixed "career areas" list on the Careers page when no openings are published. */
  showCareerAreasFallback: boolean;
};

export function defaultSettings(): Settings {
  return {
    applicationsEmail: process.env.CV_TO || process.env.CAREERS_TO || site.email.hr,
    enquiriesEmail: process.env.CONTACT_TO || site.email.general,
    notifyApplications: true,
    notifyEnquiries: true,
    showCareerAreasFallback: true,
  };
}

export async function getSettings(): Promise<Settings> {
  const base = defaultSettings();
  if (!isDbConfigured()) return base;
  try {
    const conn = await db();
    const [row] = await conn.query<{ value: Partial<Settings> }>(`SELECT value FROM settings WHERE key = 'general'`);
    return { ...base, ...(row?.value ?? {}) };
  } catch (err) {
    console.error("[settings] read failed", err instanceof Error ? err.message : err);
    return base;
  }
}

export async function saveSettings(value: Settings) {
  const conn = await db();
  await conn.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('general', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  );
}
