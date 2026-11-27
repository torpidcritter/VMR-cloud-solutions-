import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { NewCandidateForm } from "@/components/admin/talent-ui";

export const metadata: Metadata = { title: "Add candidate" };

export default async function NewCandidatePage() {
  await requireAdmin("candidates.edit");
  return (
    <div className="max-w-3xl">
      <Link href="/admin/candidates" className="text-sm text-muted hover:text-brand-600">
        ← Candidates
      </Link>
      <PageHeader title="Add a candidate" description="For people you sourced yourself (LinkedIn, referrals, events). They join the Talent Bank without an application; put them forward for an opening from their profile." />
      <Panel>
        <NewCandidateForm />
      </Panel>
    </div>
  );
}
