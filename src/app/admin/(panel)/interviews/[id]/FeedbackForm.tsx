"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { RECOMMENDATIONS, RECOMMENDATION_LABELS } from "@/lib/data/constants";
import { feedbackAction } from "../../../actions/interviews";

export function FeedbackForm({ id, values }: { id: string; values?: { rating: number; recommendation: string; notes: string } }) {
  return (
    <ActionForm action={feedbackAction} className="grid gap-4">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            <input type="hidden" name="id" value={id} />
            <fieldset>
              <legend className="a-label">Rating</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="a-chip cursor-pointer tabular-nums has-[:checked]:!border-btn has-[:checked]:!bg-btn has-[:checked]:!text-white">
                    <input type="radio" name="rating" value={n} defaultChecked={values?.rating === n} className="sr-only" />
                    {n}
                    <span className="sr-only"> out of 5</span>
                  </label>
                ))}
                <span className="self-center text-xs text-muted">1 = poor, 5 = excellent</span>
              </div>
              <FieldError error={e.rating} />
            </fieldset>
            <fieldset>
              <legend className="a-label">Recommendation</legend>
              <div className="flex flex-wrap gap-2">
                {RECOMMENDATIONS.map((r) => (
                  <label key={r} className="a-chip cursor-pointer has-[:checked]:!border-btn has-[:checked]:!bg-btn has-[:checked]:!text-white">
                    <input type="radio" name="recommendation" value={r} defaultChecked={values?.recommendation === r} className="sr-only" />
                    {RECOMMENDATION_LABELS[r]}
                  </label>
                ))}
              </div>
              <FieldError error={e.recommendation} />
            </fieldset>
            <div>
              <label htmlFor="fb-notes" className="a-label">
                Notes
              </label>
              <textarea id="fb-notes" name="notes" rows={4} maxLength={4000} defaultValue={values?.notes} placeholder="Strengths, gaps, and anything the next round should probe" className="a-field" />
            </div>
            <div className="flex justify-end">
              <SubmitButton>{values ? "Update feedback" : "Save feedback"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
