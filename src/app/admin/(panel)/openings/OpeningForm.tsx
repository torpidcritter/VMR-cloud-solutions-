"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { EMPLOYMENT_TYPES, OPENING_EXPERIENCE, OPENING_STATUSES, OPENING_STATUS_LABELS, WORK_MODES } from "@/lib/data/constants";
import { saveOpeningAction } from "../../actions/openings";

export type OpeningFormValues = {
  id?: string;
  title: string;
  sap_module: string;
  client_name: string;
  public_client_label: string;
  location: string;
  work_mode: string;
  experience: string;
  employment_type: string;
  salary_range: string;
  summary: string;
  description: string;
  skills: string;
  status: string;
  closing_date: string;
  vacancies: string;
  salary_visible: "show" | "hide";
  min_experience_years: string;
  recruiters: string[];
};

export function OpeningForm({ values, recruiterChoices = [] }: { values: OpeningFormValues; recruiterChoices?: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveOpeningAction} className="grid gap-5">
      {(state) => {
        const e = state.errors ?? {};
        const input = (name: keyof OpeningFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
          <div>
            <label htmlFor={name} className="a-label">
              {label}
            </label>
            <input id={name} name={name} defaultValue={values[name] as string} aria-invalid={!!e[name]} className="a-field" {...props} />
            <FieldError error={e[name]} />
            {hint && !e[name] && <p className="mt-1 text-xs text-muted">{hint}</p>}
          </div>
        );
        const select = (name: keyof OpeningFormValues, label: string, options: readonly string[], labels?: Record<string, string>) => (
          <div>
            <label htmlFor={name} className="a-label">
              {label}
            </label>
            <select id={name} name={name} defaultValue={values[name] as string} aria-invalid={!!e[name]} className="a-field">
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {labels?.[o] ?? o}
                </option>
              ))}
            </select>
            <FieldError error={e[name]} />
          </div>
        );
        return (
          <>
            {values.id && <input type="hidden" name="id" value={values.id} />}
            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="text-sm font-semibold sm:col-span-2">The role</h2>
              <div className="sm:col-span-2">{input("title", "Job title", { maxLength: 160, placeholder: "e.g. SAP S/4HANA FICO Consultant" })}</div>
              {input("sap_module", "SAP module or skill area", { maxLength: 80, placeholder: "e.g. FICO, ABAP, Java" })}
              {select("employment_type", "Employment type", EMPLOYMENT_TYPES)}
              {select("experience", "Experience", OPENING_EXPERIENCE)}
              {input("min_experience_years", "Minimum experience in years (optional)", { inputMode: "decimal", maxLength: 5 }, "Used to match candidates from the Talent Bank.")}
              {input("vacancies", "Number of positions", { inputMode: "numeric", maxLength: 3 })}
              {input("location", "Location", { maxLength: 160, placeholder: "e.g. Bengaluru" })}
              {select("work_mode", "Work mode", WORK_MODES)}
              {input("salary_range", "Salary or rate (optional)", { maxLength: 80, placeholder: "e.g. ₹18–24 LPA" })}
              <div>
                <label htmlFor="salary_visible" className="a-label">
                  Salary on the website
                </label>
                <select id="salary_visible" name="salary_visible" defaultValue={values.salary_visible} className="a-field">
                  <option value="show">Show it</option>
                  <option value="hide">Keep it internal</option>
                </select>
                <p className="mt-1 text-xs text-muted">A blank salary is never shown.</p>
              </div>
            </section>

            {recruiterChoices.length > 0 && (
              <fieldset className="card grid gap-3 p-5">
                <legend className="sr-only">Recruiters</legend>
                <h2 className="text-sm font-semibold" aria-hidden>
                  Recruiters
                </h2>
                <p className="-mt-1 text-xs text-muted">When exactly one recruiter is chosen, new applications for this job are assigned to them automatically.</p>
                <div className="flex flex-wrap gap-2">
                  {recruiterChoices.map((r) => (
                    <label key={r.id} className="a-chip cursor-pointer has-[:checked]:!border-btn has-[:checked]:!bg-btn has-[:checked]:!text-white">
                      <input type="checkbox" name="recruiters" value={r.id} defaultChecked={values.recruiters.includes(r.id)} className="sr-only" />
                      {r.name}
                    </label>
                  ))}
                </div>
                <input type="hidden" name="recruitersSent" value="1" />
              </fieldset>
            )}

            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="text-sm font-semibold sm:col-span-2">Client</h2>
              {input("client_name", "Client name (private)", { maxLength: 160 }, "Only admins see this. It never appears on the website.")}
              {input("public_client_label", "Shown on the website as", { maxLength: 160, placeholder: "e.g. Leading global IT services company" })}
            </section>

            <section className="card grid gap-4 p-5">
              <h2 className="text-sm font-semibold">Description</h2>
              <div>
                <label htmlFor="summary" className="a-label">
                  Short summary
                </label>
                <input id="summary" name="summary" defaultValue={values.summary} maxLength={400} className="a-field" placeholder="One line shown on the job card" />
              </div>
              <div>
                <label htmlFor="description" className="a-label">
                  Full description
                </label>
                <textarea id="description" name="description" defaultValue={values.description} rows={12} maxLength={12000} aria-invalid={!!e.description} className="a-field" />
                <FieldError error={e.description} />
                {!e.description && <p className="mt-1 text-xs text-muted">Plain text. Start a line with “- ” for a bullet point; leave a blank line between paragraphs.</p>}
              </div>
              {input("skills", "Key skills", { maxLength: 1000, placeholder: "SAP FI, SAP CO, S/4HANA" }, "Separate with commas.")}
            </section>

            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="text-sm font-semibold sm:col-span-2">Publishing</h2>
              {select("status", "Status", OPENING_STATUSES, OPENING_STATUS_LABELS)}
              {input("closing_date", "Closing date (optional)", { type: "date" }, "The opening hides itself from the website after this date.")}
            </section>

            <div className="flex items-center gap-3">
              <SubmitButton>{values.id ? "Save changes" : "Create opening"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
