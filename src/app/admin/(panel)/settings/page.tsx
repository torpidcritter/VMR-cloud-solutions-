import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import { isMailConfigured } from "@/lib/mailer";
import { isStorageConfigured } from "@/lib/cv-storage";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  const settings = await getSettings();
  const checks: [string, boolean, string][] = [
    ["Database", true, "Connected. Applications and enquiries are saved here."],
    ["Email (SMTP)", isMailConfigured(), "Needed to send notification emails. Add the SMTP_* variables in Vercel."],
    ["Resume storage (private Blob)", isStorageConfigured(), "Needed to keep resumes for download here. Connect a private Vercel Blob store."],
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <div className="grid gap-6">
        <Panel title="Connections">
          <ul className="grid gap-3 text-sm">
            {checks.map(([name, ok, help]) => (
              <li key={name} className="flex items-start justify-between gap-4">
                <span>
                  <span className="font-medium">{name}</span>
                  <span className="block text-muted">{help}</span>
                </span>
                <Badge tone={ok ? "green" : "amber"}>{ok ? "Connected" : "Not set up"}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
