"use client";

import { ActionForm, FieldError, SubmitButton } from "./forms";
import { CANDIDATE_PRIORITIES, CANDIDATE_PRIORITY_LABELS } from "@/lib/data/constants";
import { createTaskAction } from "@/app/admin/actions/tasks";

type Links = { candidate_id?: string; client_id?: string; opening_id?: string };

/** Add a task. `owners` is empty for roles that may only add tasks for themselves. */
export function TaskForm({
  meId,
  owners,
  links = {},
  applications = [],
  idPrefix = "tk",
  compact = false,
}: {
  meId: string;
  owners: { id: string; name: string }[];
  links?: Links;
  applications?: { id: string; label: string }[];
  idPrefix?: string;
  compact?: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <ActionForm action={createTaskAction} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(state) => {
        const e = state.errors ?? {};
        return (
          <>
            {Object.entries(links).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <div className="sm:col-span-2">
              <label htmlFor={id("title")} className="a-label">
                Task
              </label>
              <input id={id("title")} name="title" maxLength={200} placeholder="e.g. Call back about the notice period" className="a-field" aria-invalid={!!e.title} />
              <FieldError error={e.title} />
            </div>
            <div>
              <label htmlFor={id("due")} className="a-label">
                Due <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id={id("due")} name="due_on" type="date" className="a-field" aria-invalid={!!e.due_on} />
              <FieldError error={e.due_on} />
            </div>
            <div>
              <label htmlFor={id("priority")} className="a-label">
                Priority
              </label>
              <select id={id("priority")} name="priority" defaultValue="normal" className="a-field">
                {CANDIDATE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {CANDIDATE_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            {owners.length > 0 && (
              <div>
                <label htmlFor={id("owner")} className="a-label">
                  For
                </label>
                <select id={id("owner")} name="owner_id" defaultValue={meId} className="a-field" aria-invalid={!!e.owner_id}>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id === meId ? `${o.name} (me)` : o.name}
                    </option>
                  ))}
                </select>
                <FieldError error={e.owner_id} />
              </div>
            )}
            {applications.length > 0 && (
              <div>
                <label htmlFor={id("app")} className="a-label">
                  About
                </label>
                <select id={id("app")} name="application_id" defaultValue="" className="a-field">
                  <option value="">The candidate in general</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!compact && (
              <div className="sm:col-span-2">
                <label htmlFor={id("notes")} className="a-label">
                  Notes <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea id={id("notes")} name="notes" rows={2} maxLength={4000} className="a-field" />
              </div>
            )}
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton pendingLabel="Adding…">Add task</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
