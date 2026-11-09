import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-8 w-full rounded-sm border border-line bg-surface px-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("w-full rounded-sm border border-line bg-surface p-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("h-8 w-full rounded-sm border border-line bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand", className)} {...props} />
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-semibold text-ink", className)} {...props} />;
}

export function Field({ label, htmlFor, help, required, children, className }: { label: string; htmlFor?: string; help?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-3", className)}>
      <Label htmlFor={htmlFor} className="pt-1.5">
        {label}
        {required && <span aria-hidden="true" className="text-danger"> *</span>}
      </Label>
      <div className="min-w-0">
        {children}
        {help && <p className="mt-1 text-xs text-muted">{help}</p>}
      </div>
    </div>
  );
}
