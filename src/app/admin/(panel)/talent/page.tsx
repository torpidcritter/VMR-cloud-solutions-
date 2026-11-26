import { redirect } from "next/navigation";

/** The Talent Bank now lives on the Candidates page; keep old links working. */
export default async function TalentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? `?q=${encodeURIComponent(sp.q)}` : "";
  redirect(`/admin/candidates${q}`);
}
