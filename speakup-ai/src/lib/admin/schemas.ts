import { z } from "zod";

const str = (max: number) => z.string().trim().min(1).max(max);
const list = z.array(z.string().trim().min(1).max(60)).max(20).default([]);

export const CONTENT_SCHEMAS = {
  vocabulary: z.object({
    word: str(60), category: z.enum(["daily", "office", "interview", "ielts", "professional", "travel", "business"]), meaning: str(300),
    pronunciation: z.string().max(80).default(""), example: z.string().max(300).default(""), synonyms: list, antonyms: list,
    usage: z.string().max(300).default(""), hindi: z.string().max(300).default(""), published: z.boolean().default(true),
  }),
  interview_questions: z.object({
    category: z.enum(["hr", "fresher", "desktop", "helpdesk", "techsupport", "aws", "azure", "mainframe", "sysadmin", "customer", "teamlead", "manager"]),
    question: str(400), keywords: list, tip: z.string().max(400).default(""), sample_answer: z.string().max(2000).optional(), behavioural: z.boolean().default(false), published: z.boolean().default(true),
  }),
  ielts_questions: z.object({
    module: z.enum(["speaking", "writing", "reading", "listening"]), variant: z.enum(["academic", "general", "both"]).default("both"), title: str(200),
    content: z.object({ part: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), topic: z.string().max(80).optional(), prompt: z.string().max(2000).optional(), bullets: z.array(z.string().max(200)).max(6).optional() }).passthrough(),
    published: z.boolean().default(true),
  }),
  daily_lessons: z.object({
    day: z.number().int().min(1).max(30), title: str(120), objective: str(300), task: str(500), lesson: z.array(z.string().max(400)).max(8).default([]),
    keywords: list, min_seconds: z.number().int().min(10).max(600).default(45), published: z.boolean().default(true),
  }),
} as const;

export type ContentTable = keyof typeof CONTENT_SCHEMAS;
export const CONTENT_TABLES = Object.keys(CONTENT_SCHEMAS) as ContentTable[];

export const SETTINGS_SCHEMA = z.object({
  ai_enabled: z.boolean(),
  ai_daily_limit_guest: z.number().int().min(0).max(1000),
  ai_daily_limit_user: z.number().int().min(0).max(5000),
  ai_global_daily_limit: z.number().int().min(0).max(1_000_000),
  features: z.record(z.string(), z.boolean()),
});
