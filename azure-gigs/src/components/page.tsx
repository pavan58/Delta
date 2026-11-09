import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({ title, subtitle, crumbs = [], actions, icon }: { title: string; subtitle?: string; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/home" className="hover:text-brand hover:underline">Home</Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3" aria-hidden />
            {c.href ? <Link href={c.href} className="hover:text-brand hover:underline">{c.label}</Link> : <span>{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <h1 className="text-xl font-semibold text-ink">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
