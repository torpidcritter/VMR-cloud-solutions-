"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Paperclip, Search } from "lucide-react";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, MOVE_REFUSED, canMoveApplication, type ApplicationStatus } from "@/lib/data/constants";
import type { PipelineCard } from "@/lib/data/applications";
import { toast } from "@/components/admin/Toaster";
import { moveApplicationAction } from "../../actions/pipeline";

const TONE: Record<string, string> = {
  new: "bg-brand-500",
  screening: "bg-amber-500",
  shortlisted: "bg-violet-500",
  interview_scheduled: "bg-sky-brand",
  interview_completed: "bg-cyan-600",
  selected: "bg-emerald-500",
  offer_released: "bg-emerald-600",
  hired: "bg-emerald-700",
  rejected: "bg-accent-500",
  on_hold: "bg-slate-400",
};

const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Kanban board: drag a card to another column, or use its Move menu (keyboard and touch friendly). */
export function Board({ cards: initial, canMove, superAdmin = false }: { cards: PipelineCard[]; canMove: boolean; superAdmin?: boolean }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [, startTransition] = useTransition();
  useEffect(() => setCards(initial), [initial]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? cards.filter((c) => `${c.full_name} ${c.position} ${c.opening_title ?? ""} ${c.number}`.toLowerCase().includes(t)) : cards;
  }, [cards, q]);

  async function move(id: string, to: ApplicationStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    const from = card.status;
    // The server decides; this only saves a round trip for a move it would refuse.
    if (!canMoveApplication(from, to, superAdmin)) {
      toast(MOVE_REFUSED, "error");
      return;
    }
    setCards((list) => list.map((c) => (c.id === id ? { ...c, status: to, stage_changed_at: new Date().toISOString() } : c)));
    const res = await moveApplicationAction(id, to);
    if (res.ok) {
      toast(`${card.full_name} moved to ${APPLICATION_STATUS_LABELS[to]}.`);
      startTransition(() => router.refresh());
    } else {
      setCards((list) => list.map((c) => (c.id === id ? { ...c, status: from } : c)));
      toast(res.error, "error");
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <label className="relative mb-3 block w-full max-w-xs">
        <span className="sr-only">Filter cards on this board</span>
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards by name or role" className="a-field pl-8" />
      </label>
      <div className="relative -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <ol className="flex min-w-max gap-3" aria-label="Pipeline stages">
          {APPLICATION_STATUSES.map((stage) => {
            const col = visible.filter((c) => c.status === stage);
            return (
              <li
                key={stage}
                aria-label={`${APPLICATION_STATUS_LABELS[stage]}, ${col.length} applications`}
                onDragOver={(e) => {
                  if (!canMove || !dragging) return;
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver((o) => (o === stage ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  setOver(null);
                  setDragging(null);
                  if (id) void move(id, stage);
                }}
                className={`flex w-[17rem] shrink-0 flex-col rounded-xl border bg-surface-2/60 transition-colors ${
                  over === stage ? "border-brand-400 bg-brand-50" : "border-line"
                }`}
              >
                <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                  <span aria-hidden className={`size-2 rounded-full ${TONE[stage]}`} />
                  <h2 className="flex-1 text-[0.8rem] font-semibold text-ink">{APPLICATION_STATUS_LABELS[stage]}</h2>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">{col.length}</span>
                </div>
                <ul className="grid min-h-24 content-start gap-2 px-2 pb-2">
                  {col.map((c) => (
                    <li
                      key={c.id}
                      draggable={canMove}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(c.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      data-card={c.id}
                      className={`relative rounded-lg border border-line bg-card p-3 text-sm shadow-[0_1px_2px_rgb(15_27_51/0.05)] ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${
                        dragging === c.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/candidates/${c.candidate_id}`} className="font-semibold leading-snug text-ink hover:text-brand-600">
                          {c.full_name}
                        </Link>
                        {(c.priority === "urgent" || c.priority === "high") && (
                          <span className={`shrink-0 rounded-full px-1.5 py-px text-[0.68rem] font-bold uppercase ${c.priority === "urgent" ? "bg-red-50 text-accent-600 dark:bg-red-950/40" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                            {c.priority}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.opening_title ?? c.position}</p>
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                        <Link href={`/admin/applications/${c.id}`} className="tabular-nums hover:text-brand-600">
                          #{c.number}
                        </Link>
                        <span>·</span>
                        <span title="Days in this stage">{days(c.stage_changed_at)}d</span>
                        {c.has_resume && <Paperclip aria-label="Resume on file" className="size-3" />}
                        <span className="ml-auto">
                          {c.assigned_name ? (
                            <span title={`Recruiter: ${c.assigned_name}`} className="grid size-6 place-items-center rounded-full bg-brand-50 text-[0.65rem] font-bold text-brand-600">
                              {initials(c.assigned_name)}
                            </span>
                          ) : (
                            <span title="No recruiter assigned" className="grid size-6 place-items-center rounded-full border border-dashed border-line-strong text-[0.65rem]">
                              –
                            </span>
                          )}
                        </span>
                      </div>
                      {canMove && (
                        <label className="mt-2 block">
                          <span className="sr-only">Move {c.full_name} to stage</span>
                          <select value={c.status} onChange={(e) => void move(c.id, e.target.value as ApplicationStatus)} className="a-field !min-h-8 !py-1 text-xs">
                            {APPLICATION_STATUSES.filter((s) => s === c.status || canMoveApplication(c.status, s, superAdmin)).map((s) => (
                              <option key={s} value={s}>
                                {s === c.status ? `In ${APPLICATION_STATUS_LABELS[s]}` : `Move to ${APPLICATION_STATUS_LABELS[s]}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </li>
                  ))}
                  {!col.length && <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">{canMove ? "Drop a card here" : "Empty"}</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
