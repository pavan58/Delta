"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, NotConfigured } from "@/components/layout/AuthCard";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function UpdatePassword() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    const { error } = (await getSupabase()?.auth.updateUser({ password: pw })) ?? { error: null };
    if (error) setErr(error.message);
    else router.push("/dashboard");
  }
  return (
    <AuthCard title="Choose a new password">
      {!supabaseConfigured ? <NotConfigured /> : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm"><span className="label">New password</span><input className="input mt-1" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button className="btn btn-primary w-full">Update password</button>
        </form>
      )}
    </AuthCard>
  );
}
