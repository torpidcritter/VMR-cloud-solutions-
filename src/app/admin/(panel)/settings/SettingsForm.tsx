"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import type { Settings } from "@/lib/data/settings";
import { RETENTION_CHOICES } from "@/lib/data/constants";
import { saveSettingsAction } from "../../actions/settings";

export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <ActionForm action={saveSettingsAction} className="grid gap-6">
      {(state) => (
        <>
          <section className="card grid gap-4 p-5">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <div>
              <label htmlFor="applicationsEmail" className="a-label">
                Send applications and CVs to
              </label>
              <input id="applicationsEmail" name="applicationsEmail" defaultValue={settings.applicationsEmail} aria-invalid={!!state.errors?.applicationsEmail} className="a-field" />
              <FieldError error={state.errors?.applicationsEmail} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notifyApplications" defaultChecked={settings.notifyApplications} className="size-4" /> Email each new application (with the resume attached)
            </label>
            <div>
              <label htmlFor="enquiriesEmail" className="a-label">
                Send enquiries to
              </label>
              <input id="enquiriesEmail" name="enquiriesEmail" defaultValue={settings.enquiriesEmail} aria-invalid={!!state.errors?.enquiriesEmail} className="a-field" />
              <FieldError error={state.errors?.enquiriesEmail} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notifyEnquiries" defaultChecked={settings.notifyEnquiries} className="size-4" /> Email each new enquiry
            </label>
            <p className="text-xs text-muted">Separate several addresses with commas. Submissions are always saved in the admin panel either way.</p>
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="text-sm font-semibold">Careers page</h2>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="showCareerAreasFallback" defaultChecked={settings.showCareerAreasFallback} className="mt-0.5 size-4" />
              <span>
                When no openings are published, show the general &ldquo;career areas&rdquo; list instead
                <span className="block text-xs text-muted">The resume form always stays on the page.</span>
              </span>
            </label>
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="text-sm font-semibold">Sign-in security</h2>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="requireMfaForSuperAdmins" defaultChecked={settings.requireMfaForSuperAdmins} className="mt-0.5 size-4" />
              <span>
                Require two-step sign-in for Super Admins
                <span className="block text-xs text-muted">
                  Super Admins without an authenticator app set up are asked to set one up before they can use the panel. Anyone can turn it on for their own account from the account menu.
                </span>
              </span>
            </label>
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="text-sm font-semibold">Audit log</h2>
            <div className="max-w-xs">
              <label htmlFor="auditRetentionDays" className="a-label">
                Keep activity and sign-in records for
              </label>
              <select id="auditRetentionDays" name="auditRetentionDays" defaultValue={String(settings.auditRetentionDays)} aria-invalid={!!state.errors?.auditRetentionDays} className="a-field">
                {RETENTION_CHOICES.map((d) => (
                  <option key={d} value={d}>
                    {d % 365 === 0 ? `${d / 365} year${d === 365 ? "" : "s"}` : `${d} days`}
                  </option>
                ))}
              </select>
              <FieldError error={state.errors?.auditRetentionDays} />
            </div>
            <p className="text-xs text-muted">The daily job deletes older entries, and read notifications after 180 days. Candidate timelines are not affected.</p>
          </section>
          <div>
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
