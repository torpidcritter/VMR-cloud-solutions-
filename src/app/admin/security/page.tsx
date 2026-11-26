import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth/session";
import { otpauthUri } from "@/lib/auth/totp";
import { mfaStatus } from "@/lib/data/mfa";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime } from "@/components/admin/ui";
import { AuthShell } from "../AuthShell";
import { ConfirmSetupForm, DisableForm, RecoveryCodesForm, StartSetupForm } from "./SecurityForms";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string; required?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const status = await mfaStatus(me.id);
  const required = me.role === "super_admin" && (await getSettings()).requireMfaForSuperAdmins;
  const setup = !status?.enabledAt && sp.setup && status?.pendingSecret ? status.pendingSecret : null;
  const qr = setup ? await QRCode.toString(otpauthUri(setup, me.email), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <AuthShell
      title="Two-step sign-in"
      subtitle={
        status?.enabledAt
          ? `On since ${formatDateTime(status.enabledAt)}. Signing in asks for a code from your authenticator app after your password.`
          : "Protect your account with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others) as well as your password."
      }
    >
      {required && !status?.enabledAt && (
        <p className="mb-5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Super Admins must use two-step sign-in. Set it up to continue to the admin panel.</p>
      )}
      {status?.enabledAt ? (
        <div className="grid gap-6">
          <section>
            <h2 className="text-sm font-semibold">Recovery codes</h2>
            <p className="mt-1 text-sm text-muted">
              {status.codesLeft} of 10 left. Each one signs you in once if you don&rsquo;t have your phone. Making new ones stops the old ones working.
            </p>
            <RecoveryCodesForm />
          </section>
          <section>
            <h2 className="text-sm font-semibold">Turn off</h2>
            {required ? (
              <p className="mt-1 text-sm text-muted">Two-step sign-in is required for Super Admins, so it can&rsquo;t be turned off here.</p>
            ) : (
              <DisableForm />
            )}
          </section>
        </div>
      ) : setup && qr ? (
        <div className="grid gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this code, or type the key below.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="mx-auto w-48 rounded-xl bg-white p-2" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-center text-xs text-muted">
            Key: <code className="select-all break-all font-mono text-sm text-ink">{setup.replace(/(.{4})/g, "$1 ").trim()}</code>
          </p>
          <ConfirmSetupForm />
        </div>
      ) : (
        <StartSetupForm />
      )}
      {!(required && !status?.enabledAt) && (
        <Link href="/admin" className="mt-6 inline-block text-sm text-brand-600">
          Back to dashboard
        </Link>
      )}
    </AuthShell>
  );
}
