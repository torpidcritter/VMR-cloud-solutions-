import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listTemplates } from "@/lib/data/email";
import { MERGE_FIELDS } from "@/lib/email-templates";
import { isMailConfigured } from "@/lib/mailer";
import { ConfirmButton } from "@/components/admin/forms";
import { Badge, Notice, PageHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { TemplateForm } from "@/components/admin/crm-ui";
import { deleteTemplateAction } from "../../../actions/email";

export const metadata: Metadata = { title: "Email templates" };

export default async function EmailTemplatesPage() {
  await requireAdmin("settings.manage");
  const templates = await listTemplates();
  return (
    <>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-brand-600">
        ← Settings
      </Link>
      <PageHeader title="Email templates" description="Starting points for emails to candidates. Recruiters can change the text before sending." />
      {!isMailConfigured() && <Notice tone="amber">Email (SMTP) isn&apos;t set up yet, so emails can&apos;t be sent until it is. Templates can still be prepared.</Notice>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          {templates.map((t) => (
            <Panel
              key={t.id}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {t.name} {!t.active && <Badge>Not offered</Badge>}
                </span>
              }
              actions={
                <ConfirmButton action={deleteTemplateAction} hidden={{ id: t.id }} className="a-btn !py-1 text-xs" title={`Delete "${t.name}"?`} confirmLabel="Delete template" confirm="Emails already sent with it are kept on each candidate's profile.">
                  Delete
                </ConfirmButton>
              }
            >
              <TemplateForm template={t} />
              <p className="mt-3 text-xs text-muted">
                Last changed {formatDateTime(t.updated_at)}
                {t.updated_by_name ? ` by ${t.updated_by_name}` : ""}
              </p>
            </Panel>
          ))}
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Merge fields">
            <p className="text-sm text-muted">Type these in a subject or message. They&apos;re filled in from the candidate and the application chosen when writing.</p>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {MERGE_FIELDS.map((f) => (
                <li key={f.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{`{{${f.key}}}`}</code>
                  <span className="text-muted">{f.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">The client&apos;s name is never available here, so it can&apos;t reach a candidate by accident.</p>
          </Panel>
          <Panel title="New template">
            <TemplateForm />
          </Panel>
        </div>
      </div>
    </>
  );
}
