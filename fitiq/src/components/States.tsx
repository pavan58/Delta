import Link from "next/link";
import { Icon } from "./Icon";

export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton aspect-[4/5]" />
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "h-40" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-busy="true" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 border-risk-high/30 bg-risk-high/5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-risk-high"><Icon name="alert" className="h-4 w-4" /> Couldn&apos;t load this</p>
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && <button className="btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } | { onClick: () => void; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="max-w-md text-sm text-ink-soft">{body}</p>
      {cta && ("href" in cta ? <Link href={cta.href} className="btn-primary btn-sm">{cta.label}</Link> : <button className="btn-primary btn-sm" onClick={cta.onClick}>{cta.label}</button>)}
    </div>
  );
}

export function SectionHead({ eyebrow, title, action, children }: { eyebrow?: string; title: string; action?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="h-display text-2xl sm:text-3xl">{title}</h2>
        {children}
      </div>
      {action && (
        <Link href={action.href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
          {action.label} <Icon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export function ProfilePrompt({ what }: { what: string }) {
  return (
    <div className="card flex flex-col items-start gap-3 bg-saffron-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">Personalise this.</span> Build your style profile to see {what}.</p>
      <Link href="/onboarding" className="btn-primary btn-sm shrink-0">Build my style profile</Link>
    </div>
  );
}
