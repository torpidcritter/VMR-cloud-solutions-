"use client";

import { ActionForm, FieldError, SubmitButton } from "./forms";
import { INTERVIEW_MODES, INTERVIEW_MODE_LABELS, INTERVIEW_ROUNDS } from "@/lib/data/constants";
import { saveInterviewAction } from "@/app/admin/actions/interviews";

export type InterviewFormValues = {
  interviewId?: string;
  applicationId?: string;
  round: string;
  date: string;
  time: string;
  duration: string;
  mode: string;
  location: string;
  notes: string;
  panel: string[];
};

const DURATIONS = ["30", "45", "60", "90", "120"];

/** Schedule a new interview or change a scheduled one. Times are India time. */
export function InterviewForm({ values, interviewers, idPrefix = "iv" }: { values: InterviewFormValues; interviewers: { id: string; name: string }[]; idPrefix?: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <ActionForm action={saveInterviewAction} resetOnSuccess={!values.interviewId} className="grid gap-4">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            {values.interviewId && <input type="hidden" name="interviewId" value={values.interviewId} />}
            {values.applicationId && <input type="hidden" name="applicationId" value={values.applicationId} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={id("round")} className="a-label">
                  Round
                </label>
                <input id={id("round")} name="round" list={id("rounds")} defaultValue={values.round} maxLength={80} aria-invalid={!!e.round} className="a-field" />
                <datalist id={id("rounds")}>
                  {INTERVIEW_ROUNDS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <FieldError error={e.round} />
              </div>
              <div>
                <label htmlFor={id("date")} className="a-label">
                  Date
                </label>
                <input id={id("date")} name="date" type="date" defaultValue={values.date} aria-invalid={!!e.date} className="a-field" />
                <FieldError error={e.date} />
              </div>
              <div>
                <label htmlFor={id("time")} className="a-label">
                  Time (IST)
                </label>
                <input id={id("time")} name="time" type="time" step={300} defaultValue={values.time} className="a-field" />
              </div>
              <div>
                <label htmlFor={id("duration")} className="a-label">
                  Length
                </label>
                <select id={id("duration")} name="duration" defaultValue={values.duration} aria-invalid={!!e.duration} className="a-field">
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {Number(d) < 60 ? `${d} minutes` : Number(d) === 60 ? "1 hour" : `${Number(d) / 60} hours`}
                    </option>
                  ))}
                </select>
                <FieldError error={e.duration} />
              </div>
              <div>
                <label htmlFor={id("mode")} className="a-label">
                  How
                </label>
                <select id={id("mode")} name="mode" defaultValue={values.mode} aria-invalid={!!e.mode} className="a-field">
                  {INTERVIEW_MODES.map((m) => (
                    <option key={m} value={m}>
                      {INTERVIEW_MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
                <FieldError error={e.mode} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={id("location")} className="a-label">
                  Meeting link, phone number or address
                </label>
                <input id={id("location")} name="location" defaultValue={values.location} maxLength={300} aria-invalid={!!e.location} className="a-field" />
                <FieldError error={e.location} />
              </div>
            </div>
            <fieldset>
              <legend className="a-label">Interview panel</legend>
              <div className="flex flex-wrap gap-2">
                {interviewers.map((u) => (
                  <label key={u.id} className="a-chip cursor-pointer has-[:checked]:!border-btn has-[:checked]:!bg-btn has-[:checked]:!text-white">
                    <input type="checkbox" name="panel" value={u.id} defaultChecked={values.panel.includes(u.id)} className="sr-only" />
                    {u.name}
                  </label>
                ))}
              </div>
              <FieldError error={e.panel} />
            </fieldset>
            <div>
              <label htmlFor={id("notes")} className="a-label">
                Notes for the panel (optional)
              </label>
              <textarea id={id("notes")} name="notes" rows={2} maxLength={2000} defaultValue={values.notes} className="a-field" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {state.data?.conflict && (
                <label className="mr-auto flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allowConflicts" value="yes" /> Schedule anyway
                </label>
              )}
              <SubmitButton>{values.interviewId ? "Save changes" : "Schedule interview"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
