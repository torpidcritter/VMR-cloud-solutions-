import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import { isMailConfigured } from "@/lib/mailer";
import { isStorageConfigured } from "@/lib/cv-storage";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForm } from "./SettingsForm";
import { resumeTextCoverage } from "@/lib/data/talent";
import { ReadResumeTextButton } from "@/components/admin/talent-ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  const coverage = await resumeTextCoverage();
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
        <Panel title="Resume search">
          <p className="text-sm text-muted">
            Resumes are read when they arrive so recruiters can search them and match them to openings. {coverage.done} of {coverage.total} resume
            {coverage.total === 1 ? "" : "s"} sent through the website {coverage.total === 1 ? "has" : "have"} been read.
          </p>
          {coverage.done < coverage.total && (
            <div className="mt-3">
              <ReadResumeTextButton />
            </div>
          )}
        </Panel>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
