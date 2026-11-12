import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Logo />
      <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {updated}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      <Link href="/" className="btn btn-secondary mt-8">← Back home</Link>
    </div>
  );
}
