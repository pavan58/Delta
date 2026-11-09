import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-sm border border-line bg-surface", className)} {...props} />;
}
export function CardHeader({ title, actions, subtitle }: { title: React.ReactNode; actions?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tone = {
  green: "bg-ok-bg text-ok",
  red: "bg-danger-bg text-danger",
  amber: "bg-warn-bg text-warn",
  blue: "bg-brand-bg text-brand",
  gray: "bg-subtle text-muted",
};
export function Badge({ color = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone[color], className)} {...props} />;
}

export function statusColor(s: string): keyof typeof tone {
  const l = s.toLowerCase();
  if (/(running|succeeded|available|allowed|reachable|success|connected|active|resolved|pass|ready|enabled|completed|fired-no)/.test(l) && !/unreach|not ready/.test(l)) return "green";
  if (/(fail|denied|unreachable|unavailable|error|stopped|deallocated|crash|backoff|fired|sev1|open|forbid|expired)/.test(l)) return "red";
  if (/(degraded|pending|waiting|started|sev2|warn|deny)/.test(l)) return "amber";
  return "gray";
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("border-b border-line bg-subtle px-3 py-2 text-xs font-semibold text-muted", className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("border-b border-line px-3 py-2 align-top text-ink", className)} {...p} />;

export function Alert({ kind = "info", children, className }: { kind?: "info" | "error" | "success" | "warning"; children: React.ReactNode; className?: string }) {
  const c = { info: "border-brand bg-brand-bg", error: "border-danger bg-danger-bg", success: "border-ok bg-ok-bg", warning: "border-warn bg-warn-bg" }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={cn("rounded-sm border-l-4 px-3 py-2 text-sm text-ink", c, className)}>{children}</div>;
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pre({ children, className }: { children: React.ReactNode; className?: string }) {
  return <pre className={cn("max-h-96 overflow-auto rounded-sm bg-code p-3 font-mono text-xs leading-relaxed text-code-ink", className)}>{children}</pre>;
}
