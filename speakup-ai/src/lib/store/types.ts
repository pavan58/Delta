import type { GrammarCategory } from "@/lib/grammar/engine";

export type Level = "beginner" | "elementary" | "intermediate" | "upper-intermediate" | "advanced";
export type ExplainLang = "en" | "hi" | "both";
export type ModuleKey = "speak" | "grammar" | "challenge" | "ielts" | "interview" | "vocabulary";

export interface Profile {
  name: string;
  level: Level;
  firstLanguage: string;
  goal: string;
  dailyMinutes: number;
  wantsIelts: boolean;
  ieltsModule: "academic" | "general";
  targetBand: number;
  preparingInterviews: boolean;
  difficulty: string;
  explainLang: ExplainLang;
  onboarded: boolean;
  createdAt: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  aiEnabled: boolean;
  /** User agreed that their text may be sent to an external AI provider. */
  aiConsent: boolean;
  userProvider: "" | "openai" | "groq" | "openrouter" | "gemini" | "anthropic";
  userApiKey: string;
  userModel: string;
  speechRate: number;
  voiceURI: string;
  recognitionLang: "en-IN" | "en-US" | "en-GB";
  /** Keep the user's own audio for local playback during the session only. */
  keepRecordings: boolean;
  leaderboardOptIn: boolean;
  displayName: string;
}

export interface ScoreBreakdown {
  overall: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  /** null = not measured (e.g. typed answer). */
  pronunciation: number | null;
  relevance: number;
  /** Speaking duration in seconds. */
  durationSec: number;
  wpm: number | null;
}

export interface SpeakingSession {
  id: string;
  date: string; // ISO
  module: ModuleKey | "ielts-speaking";
  prompt: string;
  transcript: string;
  input: "voice" | "text";
  durationSec: number;
  scores: ScoreBreakdown;
}

export interface Mistake {
  id: string;
  original: string;
  corrected: string;
  category: GrammarCategory;
  reason: string;
  createdAt: string;
  revised: boolean;
  attempts: number;
}

export interface ChallengeDay {
  day: number;
  completedAt: string;
  score: number;
  transcript: string;
  scores: ScoreBreakdown;
}

export interface VocabCard {
  box: number; // Leitner box 0..5
  due: string; // ISO date (yyyy-mm-dd)
  correct: number;
  wrong: number;
  savedAt: string;
}

export interface IeltsAttempt {
  id: string;
  date: string;
  module: "listening" | "reading" | "writing" | "speaking";
  variant: "academic" | "general";
  testId: string;
  raw?: number;
  total?: number;
  band: number;
  details?: Record<string, unknown>;
  mock?: boolean;
}

export interface MockTestResult {
  id: string;
  date: string;
  variant: "academic" | "general";
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
}

export interface InterviewAnswer {
  question: string;
  answer: string;
  input: "voice" | "text";
  durationSec: number;
  scores: InterviewScores;
  corrected: string;
  feedback: string[];
}

export interface InterviewScores {
  communication: number; // /20
  grammar: number; // /20
  vocabulary: number; // /15
  relevance: number; // /20
  fluency: number; // /15
  pronunciation: number | null; // /10
  total: number; // /100
}

export interface InterviewSession {
  id: string;
  date: string;
  category: string;
  answers: InterviewAnswer[];
  total: number;
}

export interface DayActivity {
  minutes: number;
  xp: number;
  sessions: number;
}

export interface AppState {
  version: 1;
  guestId: string;
  profile: Profile | null;
  settings: Settings;
  xp: number;
  activity: Record<string, DayActivity>; // yyyy-mm-dd
  sessions: SpeakingSession[];
  mistakes: Mistake[];
  challenge: Record<number, ChallengeDay>;
  vocab: Record<string, VocabCard>;
  learnedWords: string[];
  ielts: IeltsAttempt[];
  mocks: MockTestResult[];
  interviews: InterviewSession[];
  achievements: Record<string, string>;
  referralCode: string;
  referredBy: string;
  aiUsage: { date: string; count: number };
  updatedAt: string;
}
