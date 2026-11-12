"use client";
import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { renderCard, shareText, whatsappUrl, type CardData, type CardKind } from "@/lib/share/card";
import { useAppState } from "@/lib/store/store";
import { currentStreak } from "@/lib/gamification";

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/** User-initiated sharing only: native share sheet, WhatsApp link, or PNG download. */
export function ShareButtons({ kind, data, compact }: { kind: CardKind; data: CardData; compact?: boolean }) {
  const activity = useAppState((s) => s.activity);
  const referralCode = useAppState((s) => s.referralCode);
  const [msg, setMsg] = useState("");
  const full: CardData = { ...data, streak: data.streak ?? currentStreak(activity), referralUrl: `${typeof window !== "undefined" ? location.origin : ""}/?ref=${referralCode}` };
  const text = shareText(kind, full);

  async function native() {
    try {
      const blob = await renderCard(kind, full);
      const file = new File([blob], "speakup-ai-score.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "SpeakUp AI" });
      } else if (navigator.share) {
        await navigator.share({ text, title: "SpeakUp AI" });
      } else {
        await navigator.clipboard.writeText(text);
        setMsg("Copied to clipboard!");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Sharing isn't available here — use Download or WhatsApp.");
    }
  }

  async function download() {
    const blob = await renderCard(kind, full);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speakup-ai-${kind}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white hover:opacity-90"><WhatsAppIcon /> {compact ? "WhatsApp" : "Share on WhatsApp"}</a>
        <button onClick={native} className="btn btn-secondary"><Share2 size={16} /> Share</button>
        <button onClick={download} className="btn btn-secondary"><Download size={16} /> PNG</button>
      </div>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
