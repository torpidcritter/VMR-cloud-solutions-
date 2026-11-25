"use client";

import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS } from "@/lib/data/constants";
import { updateEnquiryAction } from "../../../actions/enquiries";

export function EnquiryForm({ id, status, notes }: { id: string; status: string; notes: string }) {
  return (
    <ActionForm action={updateEnquiryAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="status" className="a-label">
          Status
        </label>
        <select id="status" name="status" defaultValue={status} className="a-field">
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ENQUIRY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="a-label">
          Internal notes
        </label>
        <textarea id="notes" name="notes" defaultValue={notes} rows={6} maxLength={8000} className="a-field" placeholder="Calls, proposals sent, next steps…" />
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
