"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, { body: mode === "login" ? { email: form.email, password: form.password } : form });
      window.location.href = mode === "register" ? "/home?welcome=1" : "/home";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      {error && <Alert kind="error">{error}</Alert>}
      {mode === "register" && (
        <div className="grid gap-1">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      )}
      <div className="grid gap-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {mode === "register" && <p className="text-xs text-muted">At least 10 characters with letters and digits.</p>}
      </div>
      <Button type="submit" size="lg" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New here? <Link href="/register" className="text-brand hover:underline">Create a learner account</Link></> : <>Already registered? <Link href="/login" className="text-brand hover:underline">Sign in</Link></>}
      </p>
    </form>
  );
}

export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-page px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-sm bg-header text-sm font-bold text-white">AG</span>
          <div>
            <p className="text-lg font-semibold text-ink">Azure Gigs</p>
            <p className="text-xs text-muted">The virtual Azure cloud experience</p>
          </div>
        </div>
        <div className="rounded-sm border border-line bg-surface p-6 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold text-ink">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Azure Gigs is an independent learning simulator. It is not affiliated with, endorsed by, or a service of Microsoft. Simulated resources do not run in Microsoft Azure.</p>
      </div>
    </div>
  );
}
