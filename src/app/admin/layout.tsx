import type { Metadata } from "next";
import { isDbConfigured } from "@/lib/db/client";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · VMR Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  if (!isDbConfigured()) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface p-6">
        <div className="card max-w-lg p-8">
          <h1 className="font-display text-xl font-bold text-ink">Connect the database to use the admin panel</h1>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>In Vercel, open the project and go to Storage, then Create Database, then Neon (Postgres).</li>
            <li>Connect it to this project for Production and Preview. Vercel adds DATABASE_URL for you.</li>
            <li>Add ADMIN_SETUP_KEY under Settings, then Environment Variables (any long secret phrase).</li>
            <li>Redeploy, then open /admin/setup to create the first Super Admin.</li>
          </ol>
          <p className="mt-4 text-sm text-muted">The tables are created automatically the first time the panel opens.</p>
        </div>
      </main>
    );
  }
  return <div className="min-h-dvh bg-surface text-ink">{children}</div>;
}
