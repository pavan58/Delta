"use client";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { authHeader } from "@/lib/supabase/client";

export function FeedbackForm() {
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ message: msg, rating: rating || undefined, page: "settings" }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setStatus("Thank you! Your feedback was sent."); setMsg(""); setRating(0); }
    else setStatus(j.error ?? "Could not send feedback.");
  }
  return (
    <form onSubmit={send} className="card space-y-2 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><MessageSquare size={18} /> Send feedback</h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={n <= rating ? "text-accent-500" : "text-muted"}>★</button>)}</div>
      <textarea className="input min-h-20 text-sm" placeholder="What should we improve? Found a wrong correction? Tell us." value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
      <button className="btn btn-secondary" disabled={msg.trim().length < 3}>Send</button>
      {status && <p className="text-sm text-muted">{status}</p>}
    </form>
  );
}
