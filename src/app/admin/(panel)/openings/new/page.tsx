import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { recruiterOptions } from "@/lib/data/applications";
import { PageHeader } from "@/components/admin/ui";
import { OpeningForm } from "../OpeningForm";

export const metadata: Metadata = { title: "New opening" };

export default async function NewOpeningPage() {
  const me = await requireAdmin("openings.edit");
  const recruiters = await recruiterOptions();
  return (
    <div className="max-w-3xl">
      <Link href="/admin/openings" className="text-sm text-muted hover:text-brand-600">
        ← Job Openings
      </Link>
      <PageHeader title="New job opening" description="Save as a draft first if you're not ready to publish." />
      <OpeningForm
        values={{
          title: "",
          sap_module: "",
          client_name: "",
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
          vacancies: "1",
          salary_visible: "show",
          min_experience_years: "",
          recruiters: me.role === "recruiter" ? [me.id] : [],
        }}
        recruiterChoices={recruiters}
      />
    </div>
  );
}
