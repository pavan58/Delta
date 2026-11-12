"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, NotConfigured } from "@/components/layout/AuthCard";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    if (password.length < 8) return setErr("Use at least 8 characters.");
    setBusy(true);
    setErr("");
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/dashboard` } });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data.session) router.push("/dashboard");
    else setDone(true);
  }

  return (
    <AuthCard title="Create your free account" subtitle="Your guest progress in this browser will be saved to your account.">
      {!supabaseConfigured ? <NotConfigured /> : done ? (
        <p className="text-sm">Check your email to confirm your account, then <Link href="/login" className="font-semibold text-brand-500">log in</Link>.</p>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm"><span className="label">Email</span><input className="input mt-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm"><span className="label">Password (8+ characters)</span><input className="input mt-1" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /> <span>I agree to the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.</span></label>
            {err && <p className="text-sm text-red-500" role="alert">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy || !agree}>{busy ? "Creating…" : "Create account"}</button>
          </form>
          {googleEnabled && <button onClick={() => getSupabase()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/dashboard` } })} className="btn btn-secondary mt-3 w-full">Sign up with Google</button>}
          <p className="mt-4 text-center text-sm">Already have an account? <Link href="/login" className="font-semibold text-brand-500">Log in</Link></p>
        </>
      )}
    </AuthCard>
  );
}
