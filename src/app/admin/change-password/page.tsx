import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { AuthShell } from "../AuthShell";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const me = await requireAdmin();
  return (
    <AuthShell
      title={me.mustChangePassword ? "Choose your own password" : "Change password"}
      subtitle={me.mustChangePassword ? "You signed in with a temporary password. Set a new one to continue." : "Other devices will be signed out."}
    >
      <ChangePasswordForm />
      {!me.mustChangePassword && (
        <Link href="/admin" className="mt-4 inline-block text-sm text-brand-600">
          Back to dashboard
        </Link>
      )}
    </AuthShell>
  );
}
