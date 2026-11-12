"use client";
import { useState } from "react";
import { AuthCard, NotConfigured } from "@/components/layout/AuthCard";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = (await getSupabase()?.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/update-password` })) ?? { error: null };
    if (error) setErr(error.message);
    else setSent(true);
  }
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure link.">
      {!supabaseConfigured ? <NotConfigured /> : sent ? <p className="text-sm">If an account exists for {email}, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm"><span className="label">Email</span><input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button className="btn btn-primary w-full">Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}
