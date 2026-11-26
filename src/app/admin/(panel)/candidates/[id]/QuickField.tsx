"use client";

import { useTransition } from "react";
import { toast } from "@/components/admin/Toaster";
import { quickCandidateAction } from "../../../actions/candidates";

/** A header control (priority, owner, follow-up) that saves as soon as it changes. */
export function QuickField({
  id,
  field,
  label,
  value,
  options,
  type = "select",
}: {
  id: string;
  field: "priority" | "owner" | "followup";
  label: string;
  value: string;
  options?: { value: string; label: string }[];
  type?: "select" | "date";
}) {
  const [pending, start] = useTransition();
  const save = (v: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("field", field);
      fd.set("value", v);
      try {
        await quickCandidateAction(fd);
        toast(`${label} saved.`);
      } catch {
        toast(`Couldn't save ${label.toLowerCase()}. Please try again.`, "error");
      }
    });
  const inputId = `q-${field}`;
  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="block text-xs text-muted">
        {label}
      </label>
      {type === "date" ? (
        <input id={inputId} type="date" defaultValue={value} disabled={pending} onChange={(e) => save(e.target.value)} className="a-field mt-1 !py-1.5 text-sm" />
      ) : (
        <select id={inputId} defaultValue={value} disabled={pending} onChange={(e) => save(e.target.value)} className="a-field mt-1 !py-1.5 text-sm">
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
