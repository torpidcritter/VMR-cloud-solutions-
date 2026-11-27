"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useConfirm } from "./forms";
import { toast } from "./Toaster";
import { bulkApplicationsAction } from "@/app/admin/actions/bulk";

/**
 * Selection and the bulk action bar for the applications table. Rows are
 * picked with checkboxes; "all matching" sends the filters instead of ids so
 * the server works out the set (capped at 500, or 100 resumes per ZIP).
 */

type Ctx = {
  selected: Set<string>;
  all: boolean;
  toggle: (id: string, on: boolean) => void;
  setPage: (on: boolean) => void;
  pageIds: string[];
};
const Selection = createContext<Ctx | null>(null);

export type BulkPerms = {
  status: boolean;
  assign: boolean;
  tag: boolean;
  followup: boolean;
  zip: boolean;
  export: boolean;
};
type Option = { value: string; label: string };

const LIMIT = 500;
const ZIP_LIMIT = 100;

export function BulkApplications({
  children,
  pageIds,
  total,
  filters,
  perms,
  stages,
  recruiters,
}: {
  children: ReactNode;
  pageIds: string[];
  total: number;
  filters: Record<string, string | undefined>;
  perms: BulkPerms;
  stages: Option[];
  recruiters: Option[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const ctx = useMemo<Ctx>(
    () => ({
      selected,
      all,
      pageIds,
      toggle: (id, on) => {
        setAll(false);
        setSelected((s) => {
          const n = new Set(s);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        });
      },
      setPage: (on) => {
        setAll(false);
        setSelected((s) => {
          const n = new Set(s);
          for (const id of pageIds)
            if (on) n.add(id);
            else n.delete(id);
          return n;
        });
      },
    }),
    [selected, all, pageIds],
  );
  const clear = () => {
    setSelected(new Set());
    setAll(false);
  };
  const count = all ? Math.min(total, LIMIT) : selected.size;
  const pageAllOn = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <Selection.Provider value={ctx}>
      {children}
      {count > 0 && (
        <BulkBar
          count={count}
          total={total}
          all={all}
          canSelectAll={!all && pageAllOn && total > selected.size}
          onSelectAll={() => setAll(true)}
          onClear={clear}
          payload={() => {
            const fd = new FormData();
            if (all) {
              fd.set("all", "1");
              for (const [k, v] of Object.entries(filters)) if (v) fd.set(`f_${k}`, v);
            } else fd.set("ids", [...selected].join(","));
            return fd;
          }}
          perms={perms}
          stages={stages}
          recruiters={recruiters}
        />
      )}
    </Selection.Provider>
  );
}

export function BulkRowCheck({ id, label }: { id: string; label: string }) {
  const ctx = useContext(Selection);
  if (!ctx) return null;
  const on = ctx.all || ctx.selected.has(id);
  return <input type="checkbox" className="size-4 accent-[var(--color-btn)]" checked={on} onChange={(e) => ctx.toggle(id, e.target.checked)} aria-label={`Select ${label}`} />;
}

export function BulkPageCheck() {
  const ctx = useContext(Selection);
  if (!ctx || !ctx.pageIds.length) return null;
  const on = ctx.all || ctx.pageIds.every((id) => ctx.selected.has(id));
  return <input type="checkbox" className="size-4 accent-[var(--color-btn)]" checked={on} onChange={(e) => ctx.setPage(e.target.checked)} aria-label="Select every application on this page" />;
}

type Op = "status" | "assign" | "tag" | "followup" | "zip" | "export";
const OPS: { op: Op; label: string }[] = [
  { op: "status", label: "Move to stage" },
  { op: "assign", label: "Assign recruiter" },
  { op: "tag", label: "Add a tag" },
  { op: "followup", label: "Set follow-up date" },
  { op: "zip", label: "Download resumes (ZIP)" },
  { op: "export", label: "Export to CSV" },
];

function filename(res: Response, fallback: string) {
  return /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallback;
}

function BulkBar({
  count,
  total,
  all,
  canSelectAll,
  onSelectAll,
  onClear,
  payload,
  perms,
  stages,
  recruiters,
}: {
  count: number;
  total: number;
  all: boolean;
  canSelectAll: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  payload: () => FormData;
  perms: BulkPerms;
  stages: Option[];
  recruiters: Option[];
}) {
  const ops = OPS.filter((o) => perms[o.op]);
  const [op, setOp] = useState<Op | "">("");
  const [value, setValue] = useState("");
  const [busy, startBusy] = useTransition();
  const { ask, node } = useConfirm();
  const router = useRouter();
  const noun = (n: number) => `${n} application${n === 1 ? "" : "s"}`;

  const download = async (url: string, fallback: string) => {
    const res = await fetch(url, { method: "POST", body: payload() });
    if (!res.ok) {
      toast((await res.text()) || "The download didn't work.", "error");
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename(res, fallback);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    const included = Number(res.headers.get("x-resumes-included") ?? 0);
    const leftOut = Number(res.headers.get("x-resumes-left-out") ?? 0);
    if (url.includes("resumes-zip"))
      toast(leftOut ? `Downloaded ${included} resumes. ${leftOut} didn't fit and are listed in not-included.txt.` : `Downloaded ${included} resume${included === 1 ? "" : "s"}.`);
    else toast("CSV downloaded.");
  };

  const run = () => {
    if (!op) return;
    if (op === "zip" || op === "export") {
      startBusy(async () => {
        try {
          if (op === "zip") await download("/admin/api/resumes-zip", "resumes.zip");
          else await download("/admin/api/applications-export", "applications.csv");
        } catch {
          toast("The download didn't work. Check your connection and try again.", "error");
        }
      });
      return;
    }
    if (op === "status" && !value) return toast("Choose a stage first.", "error");
    if (op === "assign" && !value) return toast("Choose who to assign them to.", "error");
    if (op === "tag" && !value.trim()) return toast("Type a tag first.", "error");
    const what =
      op === "status"
        ? `Move ${noun(count)} to ${stages.find((s) => s.value === value)?.label}? Each candidate's timeline will show the change.`
        : op === "assign"
          ? value === "none"
            ? `Unassign ${noun(count)}?`
            : `Assign ${noun(count)} to ${recruiters.find((r) => r.value === value)?.label}? They'll get a notification.`
          : op === "tag"
            ? `Add the tag "${value.trim()}" to the candidates behind ${noun(count)}?`
            : value
              ? `Set a follow-up on ${value} for the candidates behind ${noun(count)}?`
              : `Clear the follow-up date for the candidates behind ${noun(count)}?`;
    void ask("Apply to the selection?", what).then((yes) => {
      if (!yes) return;
      startBusy(async () => {
        const fd = payload();
        fd.set("op", op);
        fd.set("value", value);
        try {
          const res = await bulkApplicationsAction(fd);
          if (!res.ok) return toast(res.error, "error");
          toast(res.message);
          onClear();
          router.refresh();
        } catch {
          toast("That didn't go through. Try again.", "error");
        }
      });
    });
  };

  return (
    <>
      {node}
      <div className="sticky bottom-4 z-30 mt-4" role="region" aria-label="Bulk actions">
        <div className="card flex flex-wrap items-center gap-3 border-brand-400 p-3 shadow-[var(--shadow-lift)]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <strong className="tabular-nums">{all ? `All ${noun(count)} matching` : `${noun(count)} selected`}</strong>
            {all && total > LIMIT && <span className="text-xs text-muted">(the newest {LIMIT})</span>}
            {canSelectAll && (
              <button type="button" className="text-brand-600 underline-offset-2 hover:underline" onClick={onSelectAll}>
                Select all {Math.min(total, LIMIT)} matching
              </button>
            )}
            <button type="button" className="inline-flex items-center gap-1 text-muted hover:text-ink" onClick={onClear}>
              <X aria-hidden className="size-3.5" /> Clear
            </button>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <label htmlFor="bulk-op" className="sr-only">
              Bulk action
            </label>
            <select
              id="bulk-op"
              className="a-field !w-full !py-1.5 text-sm sm:!w-auto"
              value={op}
              onChange={(e) => {
                setOp(e.target.value as Op);
                setValue("");
              }}
            >
              <option value="">Choose an action…</option>
              {ops.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            {op === "status" && (
              <>
                <label htmlFor="bulk-value" className="sr-only">
                  Stage
                </label>
                <select id="bulk-value" className="a-field !w-full !py-1.5 text-sm sm:!w-auto" value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Stage…</option>
                  {stages.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {op === "assign" && (
              <>
                <label htmlFor="bulk-value" className="sr-only">
                  Recruiter
                </label>
                <select id="bulk-value" className="a-field !w-full !py-1.5 text-sm sm:!w-auto" value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Recruiter…</option>
                  <option value="none">Nobody (unassign)</option>
                  {recruiters.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {op === "tag" && (
              <>
                <label htmlFor="bulk-value" className="sr-only">
                  Tag
                </label>
                <input id="bulk-value" className="a-field !w-full !py-1.5 text-sm sm:!w-40" maxLength={40} placeholder="Tag" value={value} onChange={(e) => setValue(e.target.value)} />
              </>
            )}
            {op === "followup" && (
              <>
                <label htmlFor="bulk-value" className="sr-only">
                  Follow-up date (leave empty to clear)
                </label>
                <input id="bulk-value" type="date" className="a-field !w-full !py-1.5 text-sm sm:!w-auto" value={value} onChange={(e) => setValue(e.target.value)} />
              </>
            )}
            {op === "zip" && count > ZIP_LIMIT && <span className="text-xs text-muted">The first {ZIP_LIMIT} resumes</span>}
            <button type="button" className="a-btn a-btn-primary !py-1.5 text-sm" disabled={!op || busy} onClick={run}>
              {busy ? "Working…" : op === "zip" || op === "export" ? "Download" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
