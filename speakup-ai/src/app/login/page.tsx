"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, NotConfigured } from "@/components/layout/AuthCard";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setErr("");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
    else router.push("/dashboard");
  }

  async function google() {
    await getSupabase()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/dashboard` } });
  }

  return (
    <AuthCard title="Welcome back" subtitle="Log in to sync your progress across devices.">
      {!supabaseConfigured ? <NotConfigured /> : (
        <>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm"><span className="label">Email</span><input className="input mt-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm"><span className="label">Password</span><input className="input mt-1" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {err && <p className="text-sm text-red-500" role="alert">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          </form>
          {googleEnabled && <button onClick={google} className="btn btn-secondary mt-3 w-full">Continue with Google</button>}
          <div className="mt-4 flex justify-between text-sm"><Link href="/reset-password" className="text-brand-500">Forgot password?</Link><Link href="/signup" className="font-semibold text-brand-500">Create account</Link></div>
        </>
      )}
    </AuthCard>
  );
}
