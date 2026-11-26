import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth/session";
import { countAdmins } from "@/lib/data/users";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { next, expired } = await searchParams;
  const none = (await countAdmins()) === 0;
  return (
    <AuthShell title="Sign in" subtitle="Use the email and password your administrator gave you.">
      {none && (
        <p className="mb-5 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">
          No admin accounts exist yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline underline-offset-2">
            Create the first Super Admin
          </Link>
          .
        </p>
      )}
      {expired && <p className="mb-5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Your sign-in timed out or had too many wrong codes. Please start again.</p>}
      <LoginForm next={typeof next === "string" ? next : ""} />
    </AuthShell>
  );
}
