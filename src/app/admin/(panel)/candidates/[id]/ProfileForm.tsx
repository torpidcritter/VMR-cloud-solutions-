"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { AVAILABILITY_OPTIONS } from "@/lib/data/constants";
import { saveCandidateAction } from "../../../actions/candidates";

export type ProfileValues = {
  id: string;
  full_name: string;
  phone: string;
  location: string;
  preferred_location: string;
  specialisation: string;
  current_title: string;
  current_company: string;
  experience_years: string;
  notice_period: string;
  availability: string;
  qualifications: string;
  skills: string;
  tags: string;
  linkedin_url: string;
  summary: string;
};

export function ProfileForm({ values }: { values: ProfileValues }) {
  return (
    <ActionForm action={saveCandidateAction} className="grid gap-4">
      {(state) => {
        const e = state.errors ?? {};
        const input = (name: keyof ProfileValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
          <div className={props.className}>
            <label htmlFor={`p-${name}`} className="a-label">
              {label}
            </label>
            <input id={`p-${name}`} name={name} defaultValue={values[name]} aria-invalid={!!e[name]} {...props} className="a-field" />
            <FieldError error={e[name]} />
            {hint && !e[name] && <p className="mt-1 text-xs text-muted">{hint}</p>}
          </div>
        );
        const area = (name: keyof ProfileValues, label: string, rows = 3) => (
          <div className="sm:col-span-2">
            <label htmlFor={`p-${name}`} className="a-label">
              {label}
            </label>
            <textarea id={`p-${name}`} name={name} rows={rows} maxLength={name === "summary" ? 4000 : 2000} defaultValue={values[name]} className="a-field" />
          </div>
        );
        return (
          <>
            <input type="hidden" name="id" value={values.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              {input("full_name", "Full name", { required: true, maxLength: 120, autoComplete: "off" })}
              {input("phone", "Phone", { maxLength: 30, inputMode: "tel", autoComplete: "off" })}
              {input("current_title", "Current title", { maxLength: 160 })}
              {input("current_company", "Current company", { maxLength: 160 })}
              {input("experience_years", "Experience (years)", { inputMode: "decimal", maxLength: 5 }, "A number, for example 6.5")}
              {input("specialisation", "Specialisation", { maxLength: 120 })}
              {input("location", "Current location", { maxLength: 120 })}
              {input("preferred_location", "Preferred location", { maxLength: 120 })}
              {input("notice_period", "Notice period", { maxLength: 60 }, "For example 30 days, or Serving notice")}
              <div>
                <label htmlFor="p-availability" className="a-label">
                  Availability
                </label>
                <select id="p-availability" name="availability" defaultValue={values.availability} aria-invalid={!!e.availability} className="a-field">
                  <option value="">Not known</option>
                  {AVAILABILITY_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <FieldError error={e.availability} />
              </div>
              {input("skills", "Skills", { maxLength: 2000, className: "sm:col-span-2" }, "Separate with commas, for example SAP FICO, S/4HANA, IFRS")}
              {input("tags", "Tags", { maxLength: 800, className: "sm:col-span-2" }, "Internal labels, for example Bench, Relocation OK")}
              {input("linkedin_url", "LinkedIn profile", { maxLength: 300, inputMode: "url", className: "sm:col-span-2" })}
              {area("qualifications", "Qualifications and certifications", 2)}
              {area("summary", "Recruiter summary", 4)}
            </div>
            <div className="flex justify-end">
              <SubmitButton>Save profile</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
