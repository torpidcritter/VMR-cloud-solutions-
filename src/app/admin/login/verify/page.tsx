import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin, pendingChallenge } from "@/lib/auth/session";
import { AuthShell } from "../../AuthShell";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  if (!(await pendingChallenge())) redirect("/admin/login?expired=1");
  const { next } = await searchParams;
  return (
    <AuthShell title="Enter your code" subtitle="Open your authenticator app and enter the 6-digit code for VMR Cloud Admin.">
      <VerifyForm next={typeof next === "string" ? next : ""} />
      <p className="mt-4 text-xs text-muted">
        Lost your phone? Enter one of your recovery codes instead, or ask a Super Admin to switch two-step sign-in off for your account.{" "}
        <Link href="/admin/login" className="underline underline-offset-2">
          Start again
        </Link>
      </p>
    </AuthShell>
  );
}
