import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <p className="mt-4 text-center text-sm text-muted"><Link href="/start" className="font-semibold text-brand-500">Continue as guest</Link> — no account needed</p>
    </div>
  );
}

export function NotConfigured() {
  return <p className="rounded-lg bg-amber-500/10 p-3 text-sm">Accounts are not enabled on this installation. The site owner needs to configure Supabase (see the deployment guide). You can still use every feature in guest mode.</p>;
}
