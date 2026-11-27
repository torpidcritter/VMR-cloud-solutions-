import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { countAdmins } from "@/lib/data/users";
import { AuthShell } from "../AuthShell";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "First-time setup" };

export default async function SetupPage() {
  if ((await countAdmins()) > 0) redirect("/admin/login");
  if (!process.env.ADMIN_SETUP_KEY) {
    return (
      <AuthShell title="Setup is switched off">
        <p className="text-sm text-ink-soft">
          Add an environment variable named <code className="rounded bg-surface-2 px-1">ADMIN_SETUP_KEY</code> in Vercel (any long secret phrase), redeploy, then come back to this page.
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create the first Super Admin" subtitle="This page works once. After the first account exists, new admins are added from the Users page.">
      <SetupForm />
    </AuthShell>
  );
}
