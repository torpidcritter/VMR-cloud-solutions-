import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import { isMailConfigured } from "@/lib/mailer";
import { isStorageConfigured } from "@/lib/cv-storage";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForm } from "./SettingsForm";
import { resumeTextCoverage } from "@/lib/data/talent";
import { ReadResumeTextButton } from "@/components/admin/talent-ui";
import { listTemplates } from "@/lib/data/email";
import { outboxStats } from "@/lib/data/outbox";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  const coverage = await resumeTextCoverage();
  const [settings, templates, outbox] = await Promise.all([getSettings(), listTemplates(), outboxStats()]);
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
          {(outbox.pending > 0 || outbox.gaveUp > 0) && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {outbox.pending > 0 && <>{outbox.pending} notification email{outbox.pending === 1 ? "" : "s"} to the team failed to send and will be retried by the daily job. </>}
              {outbox.gaveUp > 0 && <>{outbox.gaveUp} could not be sent after several tries; the submissions themselves are saved under Applications.</>}
            </p>
          )}
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
        <Panel title="Candidate email templates">
          <p className="text-sm text-muted">
            {templates.filter((t) => t.active).length} of {templates.length} template{templates.length === 1 ? "" : "s"} offered when recruiters email a candidate from their profile.
          </p>
          <Link href="/admin/settings/email-templates" className="a-btn mt-3">
            Manage templates
          </Link>
        </Panel>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
