import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, ClipboardList, ExternalLink, Mail, Phone, Plus, Send, Star, Trash2, UserCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { clientOpenings, getClient, listClientEvents, listContacts, listRequirements, managerOptions, websiteHref } from "@/lib/data/clients";
import { REQUIREMENT_STATUSES, REQUIREMENT_STATUS_LABELS, type RequirementStatus } from "@/lib/data/constants";
import { ConfirmButton } from "@/components/admin/forms";
import { Badge, ClientStatusBadge, Notice, OpeningStatusBadge, PageHeader, Panel, StatCard, formatDate, formatDateTime, type Tone } from "@/components/admin/ui";
import { ClientForm, ClientNoteForm, ContactForm, RequirementForm } from "@/components/admin/crm-ui";
import { deleteClientAction, deleteContactAction, deleteRequirementAction, primaryContactAction, requirementStatusAction } from "../../../actions/clients";

export const metadata: Metadata = { title: "Client" };

const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 40) : undefined);
const REQ_TONE: Record<RequirementStatus, Tone> = { open: "blue", on_hold: "amber", filled: "green", cancelled: "grey" };
const EVENT_LABEL: Record<string, string> = { note: "Note", edit: "Details", contact: "Contact", requirement: "Requirement", opening: "Opening" };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("clients.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getClient(id);
  if (!c) notFound();
  const editable = can(me.role, "clients.edit");
  const editing = editable && one(sp.edit) === "1";
  // Which openings belong to a client is confidential to roles that may see client names on openings.
  const seeOpenings = can(me.role, "openings.viewClient");
  const canOpen = can(me.role, "openings.edit");
  const [contacts, requirements, openings, events, managers] = await Promise.all([
    listContacts(c.id),
    listRequirements(c.id),
    clientOpenings(c.id),
    listClientEvents(c.id),
    editing ? managerOptions() : Promise.resolve([]),
  ]);
  const totals = openings.reduce((t, o) => ({ apps: t.apps + o.applications, live: t.live + o.in_process, placed: t.placed + o.placed }), { apps: 0, live: 0, placed: 0 });
  const openCount = openings.filter((o) => o.status !== "closed").length;
  const openPositions = requirements.filter((r) => r.status === "open").reduce((n, r) => n + r.positions, 0);
  const base = `/admin/clients/${c.id}`;

  return (
    <>
      <Link href="/admin/clients" className="text-sm text-muted hover:text-brand-600">
        ← Clients
      </Link>
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ClientStatusBadge status={c.status} />
            <span>{[c.industry, c.location, `Account manager: ${c.account_manager_name ?? "none yet"}`].filter(Boolean).join(" · ")}</span>
          </span>
        }
        actions={
          <>
            {c.website && (
              <a href={websiteHref(c.website)} target="_blank" rel="noreferrer noopener" className="a-btn">
                <ExternalLink aria-hidden className="size-4" /> Website
              </a>
            )}
            {editable && !editing && (
              <Link href={`${base}?edit=1`} className="a-btn">
                Edit details
              </Link>
            )}
          </>
        }
      />
      {one(sp.created) === "1" && <Notice tone="green">Client added.{c.enquiry_number ? ` It's linked to website enquiry #${c.enquiry_number}.` : ""}</Notice>}
      {one(sp.linked) === "1" && <Notice tone="green">This client already existed, so the enquiry and its contact were added here.</Notice>}
      {one(sp.blocked) === "1" && <Notice tone="amber">This client still has job openings. Move them to another client or delete them first.</Notice>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Positions requested"
          value={openPositions}
          icon={ClipboardList}
          tone="amber"
          hint={`${requirements.filter((r) => r.status === "open").length} open requirement${requirements.filter((r) => r.status === "open").length === 1 ? "" : "s"}`}
        />
        <StatCard label="Open job openings" value={seeOpenings ? openCount : "—"} icon={BriefcaseBusiness} />
        <StatCard label="Candidates submitted" value={seeOpenings ? totals.apps : "—"} icon={Send} tone="cyan" hint={seeOpenings ? `${totals.live} in process now` : undefined} />
        <StatCard label="Placed" value={seeOpenings ? totals.placed : "—"} icon={UserCheck} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          {editing ? (
            <Panel title="Edit details" actions={<Link href={base} className="text-sm text-muted hover:text-brand-600">Done</Link>}>
              <ClientForm
                values={{
                  id: c.id,
                  name: c.name,
                  industry: c.industry,
                  website: c.website,
                  location: c.location,
                  status: c.status,
                  account_manager_id: c.account_manager_id ?? "",
                  notes: c.notes,
                }}
                managers={managers}
              />
            </Panel>
          ) : (
            c.notes && (
              <Panel title="Notes">
                <p className="whitespace-pre-line text-sm leading-relaxed">{c.notes}</p>
              </Panel>
            )
          )}

          <Panel title={`Requirements${requirements.length ? ` (${requirements.length})` : ""}`} bodyClass="">
            {requirements.length ? (
              <ul className="divide-y divide-line">
                {requirements.map((r) => (
                  <li key={r.id} className="grid gap-2 px-5 py-3.5 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.positions} × {r.title}
                        </p>
                        <p className="text-xs text-muted">
                          {[r.sap_module, r.needed_by ? `needed by ${formatDate(r.needed_by)}` : "", `added ${formatDate(r.created_at)}${r.created_by_name ? ` by ${r.created_by_name}` : ""}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Badge tone={REQ_TONE[r.status]}>{REQUIREMENT_STATUS_LABELS[r.status]}</Badge>
                    </div>
                    {r.notes && <p className="whitespace-pre-line text-ink-soft">{r.notes}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      {r.opening_id ? (
                        seeOpenings ? (
                          <Link href={`/admin/openings/${r.opening_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                            Opening: {r.opening_title}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">An opening is linked</span>
                        )
                      ) : (
                        canOpen &&
                        seeOpenings &&
                        r.status === "open" && (
                          <Link href={`/admin/openings/new?requirement=${r.id}`} className="a-btn !py-1 text-xs">
                            <Plus aria-hidden className="size-3.5" /> Create opening
                          </Link>
                        )
                      )}
                      {editable && (
                        <>
                          <form action={requirementStatusAction} className="ml-auto flex items-center gap-1.5">
                            <input type="hidden" name="id" value={r.id} />
                            <label htmlFor={`rq-st-${r.id}`} className="sr-only">
                              Status of {r.title}
                            </label>
                            <select id={`rq-st-${r.id}`} name="status" defaultValue={r.status} className="a-field !w-auto !py-1 text-xs">
                              {REQUIREMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {REQUIREMENT_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                            <button className="a-btn !py-1 text-xs">Update</button>
                          </form>
                          <ConfirmButton
                            action={deleteRequirementAction}
                            hidden={{ id: r.id }}
                            className="a-btn !py-1"
                            title="Remove this requirement?"
                            confirmLabel="Remove"
                            confirm={`${r.positions} × ${r.title} will be removed from ${c.name}. Any opening made from it is kept.`}
                          >
                            <Trash2 aria-hidden className="size-3.5" />
                            <span className="sr-only">Remove {r.title}</span>
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No requirements logged yet.</p>
            )}
            {editable && (
              <details className="border-t border-line px-5 py-4">
                <summary className="cursor-pointer text-sm font-medium text-brand-600">Log a new requirement</summary>
                <div className="mt-4">
                  <RequirementForm clientId={c.id} />
                </div>
              </details>
            )}
          </Panel>

          <Panel title={`Job openings${seeOpenings && openings.length ? ` (${openings.length})` : ""}`} bodyClass="">
            {!seeOpenings ? (
              <p className="px-5 py-4 text-sm text-muted">Your role can&apos;t see which openings belong to a client.</p>
            ) : openings.length ? (
              <div className="relative overflow-x-auto">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th scope="col">Opening</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Applied
                      </th>
                      <th scope="col" className="text-right">
                        In process
                      </th>
                      <th scope="col" className="text-right">
                        Placed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {openings.map((o) => (
                      <tr key={o.id}>
                        <td className="min-w-48">
                          <Link href={`/admin/openings/${o.id}`} className="font-medium hover:text-brand-600">
                            {o.title}
                          </Link>
                          <div className="text-xs text-muted">
                            {o.location} · {o.vacancies} position{o.vacancies === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td>
                          <OpeningStatusBadge status={o.status} />
                        </td>
                        <td className="text-right tabular-nums">
                          <Link href={`/admin/applications?opening=${o.id}`} className="hover:text-brand-600">
                            {o.applications}
                          </Link>
                        </td>
                        <td className="text-right tabular-nums">{o.in_process}</td>
                        <td className="text-right tabular-nums">{o.placed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No openings for this client yet. Openings are linked by the client name on the opening.</p>
            )}
          </Panel>

          <Panel title="History">
            {editable && (
              <div className="mb-5">
                <ClientNoteForm clientId={c.id} />
              </div>
            )}
            {events.length ? (
              <ol className="grid gap-3">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <Badge tone={e.kind === "note" ? "blue" : e.kind === "requirement" ? "amber" : e.kind === "opening" ? "violet" : "grey"}>{EVENT_LABEL[e.kind] ?? e.kind}</Badge>
                      <span>
                        {e.user_name ?? "System"} · {formatDateTime(e.created_at)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-line">{e.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No history yet.</p>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Contacts" bodyClass="">
            {contacts.length ? (
              <ul className="divide-y divide-line">
                {contacts.map((k) => (
                  <li key={k.id} className="grid gap-1 px-5 py-3.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{k.name}</span>
                      {k.is_primary && <Badge tone="blue">Primary</Badge>}
                    </div>
                    {k.title && <span className="text-xs text-muted">{k.title}</span>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {k.email && (
                        <a href={`mailto:${k.email}`} className="inline-flex items-center gap-1 break-all text-brand-600 hover:underline">
                          <Mail aria-hidden className="size-3.5 shrink-0" /> {k.email}
                        </a>
                      )}
                      {k.phone && (
                        <a href={`tel:${k.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                          <Phone aria-hidden className="size-3.5 shrink-0" /> {k.phone}
                        </a>
                      )}
                    </div>
                    {editable && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {!k.is_primary && (
                          <form action={primaryContactAction}>
                            <input type="hidden" name="id" value={k.id} />
                            <button className="a-btn !py-1 text-xs">
                              <Star aria-hidden className="size-3.5" /> Make primary
                            </button>
                          </form>
                        )}
                        <ConfirmButton
                          action={deleteContactAction}
                          hidden={{ id: k.id }}
                          className="a-btn !py-1 text-xs"
                          title="Remove this contact?"
                          confirmLabel="Remove contact"
                          confirm={`${k.name} will be removed from ${c.name}.`}
                        >
                          Remove
                        </ConfirmButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No contacts yet.</p>
            )}
            {editable && (
              <details className="border-t border-line px-5 py-4" open={!contacts.length}>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">Add a contact</summary>
                <div className="mt-4">
                  <ContactForm clientId={c.id} />
                </div>
              </details>
            )}
          </Panel>

          <Panel title="Record">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted">Added</dt>
                <dd>{formatDateTime(c.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted">Last change</dt>
                <dd>{formatDateTime(c.updated_at)}</dd>
              </div>
              {c.enquiry_id && (
                <div>
                  <dt className="text-muted">Came from</dt>
                  <dd>
                    {can(me.role, "enquiries.view") ? (
                      <Link href={`/admin/enquiries/${c.enquiry_id}`} className="text-brand-600 hover:underline">
                        Website enquiry #{c.enquiry_number}
                      </Link>
                    ) : (
                      `Website enquiry #${c.enquiry_number}`
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {can(me.role, "clients.delete") && (
              <div className="mt-5 border-t border-line pt-4">
                {seeOpenings && openings.length ? (
                  <p className="text-xs text-muted">A client with openings can&apos;t be deleted.</p>
                ) : (
                  <ConfirmButton
                    action={deleteClientAction}
                    hidden={{ id: c.id }}
                    title={`Delete ${c.name}?`}
                    confirmLabel="Delete client"
                    confirm="Its contacts, requirements and history are deleted too. This can't be undone."
                  >
                    Delete client
                  </ConfirmButton>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
