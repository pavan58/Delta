"use client";
/**
 * Admin-added content (vocabulary, interview questions, IELTS speaking topics)
 * is stored in Supabase and merged with the built-in content. Reads are public
 * (RLS: published rows only). In free/guest mode without Supabase this is empty.
 */
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Word, VocabCategory } from "@/content/vocabulary/words";
import type { InterviewQuestion } from "@/content/interviews/questions";

export interface CustomContent {
  vocabulary: Word[];
  interview: Array<InterviewQuestion & { category: string }>;
  ieltsSpeaking: Array<{ part: 1 | 2 | 3; topic: string; prompt: string; bullets: string[] }>;
}

const EMPTY: CustomContent = { vocabulary: [], interview: [], ieltsSpeaking: [] };
let cache: Promise<CustomContent> | null = null;

async function load(): Promise<CustomContent> {
  const sb = getSupabase();
  if (!sb) return EMPTY;
  try {
    const [v, i, q] = await Promise.all([
      sb.from("vocabulary").select("*").eq("published", true).limit(500),
      sb.from("interview_questions").select("*").eq("published", true).limit(500),
      sb.from("ielts_questions").select("*").eq("published", true).eq("module", "speaking").limit(200),
    ]);
    return {
      vocabulary: ((v.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: `custom-${r.id}`, word: String(r.word), category: (r.category as VocabCategory) ?? "daily", meaning: String(r.meaning ?? ""), pron: String(r.pronunciation ?? ""),
        example: String(r.example ?? ""), synonyms: (r.synonyms as string[]) ?? [], antonyms: (r.antonyms as string[]) ?? [], usage: String(r.usage ?? ""), hi: String(r.hindi ?? ""),
      })),
      interview: ((i.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        q: String(r.question), keywords: (r.keywords as string[]) ?? [], tip: String(r.tip ?? ""), behavioural: Boolean(r.behavioural), sample: r.sample_answer ? String(r.sample_answer) : undefined, category: String(r.category),
      })),
      ieltsSpeaking: ((q.data ?? []) as Array<Record<string, unknown>>).map((r) => {
        const c = (r.content ?? {}) as { part?: 1 | 2 | 3; topic?: string; prompt?: string; bullets?: string[] };
        return { part: c.part ?? 1, topic: c.topic ?? "Custom", prompt: c.prompt ?? String(r.title ?? ""), bullets: c.bullets ?? [] };
      }),
    };
  } catch {
    return EMPTY;
  }
}

export function useCustomContent(): CustomContent {
  const [c, setC] = useState<CustomContent>(EMPTY);
  useEffect(() => {
    cache ??= load();
    let alive = true;
    cache.then((x) => alive && setC(x));
    return () => {
      alive = false;
    };
  }, []);
  return c;
}

export function invalidateCustomContent() {
  cache = null;
}
