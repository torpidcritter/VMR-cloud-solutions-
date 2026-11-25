"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import type { Settings } from "@/lib/data/settings";
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
          <div>
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
