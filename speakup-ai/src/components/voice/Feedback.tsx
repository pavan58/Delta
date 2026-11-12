"use client";
import { CheckCircle2, Lightbulb, Sparkles, Volume2, XCircle } from "lucide-react";
import type { GrammarReport } from "@/lib/grammar/engine";
import { CATEGORY_LABELS } from "@/lib/grammar/engine";
import type { ScoreBreakdown } from "@/lib/store/types";
import { useAppState } from "@/lib/store/store";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { Bar, EstimateNote, ScoreRing } from "@/components/ui/Score";
import { formatDuration } from "@/lib/utils";

export function Speak({ text, label = "Listen" }: { text: string; label?: string }) {
  const tts = useSpeechSynthesis();
  const rate = useAppState((s) => s.settings.speechRate);
  const voiceURI = useAppState((s) => s.settings.voiceURI);
  if (!tts.supported) return null;
  return (
    <button onClick={() => (tts.speaking ? tts.cancel() : tts.speak(text, { rate, voiceURI }))} className="btn btn-ghost px-2 py-1 text-xs" aria-label={`${label}: ${text}`}>
      <Volume2 size={14} /> {tts.speaking ? "Stop" : label}
    </button>
  );
}

export function GrammarFeedback({ report, showProfessional = true }: { report: GrammarReport; showProfessional?: boolean }) {
  const lang = useAppState((s) => s.profile?.explainLang ?? "en");
  const issues = report.issues.filter((i) => i.category !== "filler");
  const changed = report.corrected.replace(/[.?!]$/, "").toLowerCase() !== report.input.trim().replace(/[.?!]$/, "").toLowerCase();
  return (
    <div className="space-y-3">
      {issues.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl bg-mint-500/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 shrink-0 text-mint-500" size={18} />
          <p><b>No common mistakes found.</b> The free checker looks for frequent errors; for deeper feedback you can enable AI in Settings.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((i, k) => (
            <li key={k} className="rounded-xl border border-base p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{CATEGORY_LABELS[i.category]}</span>
                <span className="flex items-center gap-1 text-red-500 line-through decoration-2"><XCircle size={14} /> {i.original}</span>
                <span aria-hidden>→</span>
                <span className="flex items-center gap-1 font-semibold text-mint-500"><CheckCircle2 size={14} /> {i.replacement}</span>
              </div>
              {(lang === "en" || lang === "both") && <p className="mt-1.5 text-muted">{i.message}</p>}
              {(lang === "hi" || lang === "both") && <p className="mt-1 text-muted" lang="hi">{i.hi}</p>}
            </li>
          ))}
        </ul>
      )}
      {changed && (
        <div className="rounded-xl surface-2 p-3 text-sm">
          <p className="label">Correct sentence</p>
          <p className="mt-1 font-medium">{report.corrected} <Speak text={report.corrected} /></p>
        </div>
      )}
      {showProfessional && report.professional !== report.corrected && (
        <div className="rounded-xl surface-2 p-3 text-sm">
          <p className="label flex items-center gap-1"><Sparkles size={14} /> Better professional version</p>
          <p className="mt-1 font-medium">{report.professional} <Speak text={report.professional} /></p>
        </div>
      )}
      {report.fillerCount > 0 && (
        <p className="text-sm text-muted">Fillers: {Object.entries(report.fillers).map(([k, v]) => `"${k}" ×${v}`).join(", ")}</p>
      )}
      {report.practice.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-brand-300 p-3 text-sm">
          <Lightbulb className="mt-0.5 shrink-0 text-accent-500" size={18} />
          <div>
            <p className="font-semibold">Practice question</p>
            <p className="text-muted">{report.practice[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScoreReport({ scores, tips, title = "Your speaking score" }: { scores: ScoreBreakdown; tips?: string[]; title?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="text-center">
          <ScoreRing value={scores.overall} size={110} label="Score" />
          <p className="mt-1 text-xs text-muted">Estimated</p>
        </div>
        <div className="w-full flex-1 space-y-3">
          <p className="font-semibold">{title}</p>
          <Bar label="Grammar accuracy" value={scores.grammar} />
          <Bar label="Fluency indicators" value={scores.fluency} />
          <Bar label="Vocabulary" value={scores.vocabulary} />
          <Bar label="Pronunciation" note="estimate from recognition clarity" value={scores.pronunciation} />
          <Bar label="Answer relevance" value={scores.relevance} />
          <p className="text-xs text-muted">
            Measured: {scores.durationSec ? formatDuration(scores.durationSec) : "—"}
            {scores.wpm !== null ? ` · ${scores.wpm} words/min` : ""}
          </p>
        </div>
      </div>
      {tips && tips.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {tips.map((t) => (
            <li key={t} className="flex gap-2"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent-500" /> {t}</li>
          ))}
        </ul>
      )}
      <EstimateNote className="mt-4" />
    </div>
  );
}
