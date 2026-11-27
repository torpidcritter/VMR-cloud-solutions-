import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { recruiterOptions } from "@/lib/data/applications";
import { can } from "@/lib/auth/permissions";
import { clientNames, getRequirement } from "@/lib/data/clients";
import { Notice, PageHeader } from "@/components/admin/ui";
import { OpeningForm } from "../OpeningForm";

export const metadata: Metadata = { title: "New opening" };

export default async function NewOpeningPage({ searchParams }: { searchParams: Promise<{ requirement?: string }> }) {
  const me = await requireAdmin("openings.edit");
  const sp = await searchParams;
  const showClient = can(me.role, "openings.viewClient");
  const [recruiters, names, req] = await Promise.all([
    recruiterOptions(),
    showClient ? clientNames() : Promise.resolve([]),
    // A client requirement to turn into an opening (from the client page).
    showClient && typeof sp.requirement === "string" ? getRequirement(sp.requirement) : Promise.resolve(null),
  ]);
  const fromReq = req && !req.opening_id ? req : null;
  return (
    <div className="max-w-3xl">
      <Link href="/admin/openings" className="text-sm text-muted hover:text-brand-600">
        ← Job Openings
      </Link>
      <PageHeader title="New job opening" description="Save as a draft first if you're not ready to publish." />
      {fromReq && (
        <Notice tone="blue">
          Filled in from {fromReq.client_name}&apos;s requirement for {fromReq.positions} × {fromReq.title}. The requirement is linked to this opening when you save.
        </Notice>
      )}
      <OpeningForm
        values={{
          title: fromReq?.title ?? "",
          sap_module: fromReq?.sap_module ?? "",
          client_name: fromReq?.client_name ?? "",
          public_client_label: "",
          location: "Bengaluru",
          work_mode: "Hybrid",
          experience: "",
          employment_type: "Permanent",
          salary_range: "",
          summary: "",
          description: "",
          skills: "",
          status: "draft",
          closing_date: "",
          vacancies: String(fromReq?.positions ?? 1),
          salary_visible: "show",
          min_experience_years: "",
          recruiters: me.role === "recruiter" ? [me.id] : [],
        }}
        recruiterChoices={recruiters}
        clientNames={names}
        requirementId={fromReq?.id}
      />
    </div>
  );
}
