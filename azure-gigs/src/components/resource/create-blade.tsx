"use client";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { CREATE_FORMS, FieldSpec, LOCATION_OPTIONS, toInput } from "./forms";
import { useResources } from "./hooks";
import { T } from "@/lib/sim/types";

export function Blade({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-sm hover:bg-subtle"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function parseTags(s: string) {
  const out: Record<string, string> = {};
  for (const part of s.split(",").map((x) => x.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    out[i < 0 ? part : part.slice(0, i).trim()] = i < 0 ? "" : part.slice(i + 1).trim();
  }
  return out;
}

export function FieldInput({ f, value, onChange, id }: { f: FieldSpec; value: unknown; onChange: (v: unknown) => void; id: string }) {
  const rgs = useResources(f.kind === "rg" ? [T.RG] : []);
  const res = useResources(f.kind === "resource" && f.resourceType ? [f.resourceType] : []);
  switch (f.kind) {
    case "select":
      return <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>{!f.required && <option value="">(none)</option>}{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    case "location":
      return <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>{!f.required && <option value="">(same as resource group)</option>}{LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    case "rg":
      return (
        <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.required ? "Select a resource group" : "(none)"}</option>
          {(rgs.rows ?? []).map((r) => <option key={r.id} value={r.name}>{r.name} ({r.location})</option>)}
        </Select>
      );
    case "resource":
      return (
        <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.required ? "Select…" : "(none)"}</option>
          {(res.rows ?? []).map((r) => <option key={r.id} value={r.type === T.SQL_DB ? r.name : r.name}>{r.name}</option>)}
        </Select>
      );
    case "checkbox":
      return <input id={id} type="checkbox" className="mt-2 size-4 accent-brand" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case "textarea":
      return <Textarea id={id} rows={5} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input id={id} type="number" value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "password":
      return <Input id={id} type="password" autoComplete="new-password" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input id={id} placeholder={f.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function CreateBlade({ type, onClose, onCreated, defaults = {} }: { type: string; onClose: () => void; onCreated: (r: { id: string; name: string }) => void; defaults?: Record<string, unknown> }) {
  const spec = CREATE_FORMS[type];
  const initial = useMemo(() => Object.fromEntries(spec.fields.map((f) => [f.name, defaults[f.name] ?? (f.kind === "list" || f.kind === "tags" ? f.default ?? "" : f.default)])), [spec, defaults]);
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const v: Record<string, unknown> = { ...values };
      for (const f of spec.fields) {
        if (f.kind === "tags") v[f.name] = parseTags(String(v[f.name] ?? ""));
        if (f.kind === "list") v[f.name] = String(v[f.name] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      }
      const r = await api("/api/resources", { body: { type, input: toInput(type, v) } });
      onCreated(r.resource);
    } catch (e) {
      setError((e as Error).message);
      setStep("form");
    } finally {
      setBusy(false);
    }
  };
  const missing = spec.fields.filter((f) => f.required && (values[f.name] === undefined || values[f.name] === "")).map((f) => f.label);
  return (
    <Blade title={spec.title} onClose={onClose}>
      <div className="mb-4 flex gap-4 border-b border-line text-sm">
        {(["form", "review"] as const).map((s) => (
          <button key={s} onClick={() => (s === "review" && missing.length ? setError(`Required: ${missing.join(", ")}`) : setStep(s))} className={`-mb-px border-b-2 px-1 pb-2 ${step === s ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}>
            {s === "form" ? "Basics" : "Review + create"}
          </button>
        ))}
      </div>
      {error && <Alert kind="error" className="mb-3">{error}</Alert>}
      {step === "form" ? (
        <div className="grid gap-4">
          {spec.fields.map((f) => (
            <Field key={f.name} label={f.label} htmlFor={`f-${f.name}`} help={f.help} required={f.required}>
              <FieldInput id={`f-${f.name}`} f={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
            </Field>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 text-sm">
          <Alert kind="success">Validation passed client-side. The simulator validates again on create.</Alert>
          {spec.fields.map((f) => (
            <div key={f.name} className="grid grid-cols-[200px_1fr] gap-2">
              <span className="text-muted">{f.label}</span>
              <span className="text-ink">{f.kind === "password" ? (values[f.name] ? "••••••••" : "-") : String(values[f.name] ?? "-") || "-"}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sticky bottom-0 mt-6 flex gap-2 border-t border-line bg-surface pt-3">
        {step === "form" ? <Button onClick={() => (missing.length ? setError(`Required: ${missing.join(", ")}`) : setStep("review"))}>Review + create</Button> : <Button onClick={submit} disabled={busy}>{busy ? "Deploying…" : "Create"}</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Blade>
  );
}
