import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withUser, readJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { INTERVIEW_QUESTIONS } from "@/content/paths";

/** Scores free-text mock interview answers by key concept coverage, and returns model answers. */
export const POST = withUser(async (req, { user }) => {
  const body = z.object({ answers: z.array(z.object({ index: z.number().int().min(0).max(INTERVIEW_QUESTIONS.length - 1), answer: z.string().max(4000) })).min(1).max(20) }).parse(await readJson(req));
  const review = body.answers.map(({ index, answer }) => {
    const q = INTERVIEW_QUESTIONS[index];
    const hits = q.keywords.filter((k) => answer.toLowerCase().includes(k.toLowerCase()));
    const score = Math.round((hits.length / q.keywords.length) * 100);
    return { question: q.q, topic: q.topic, score, covered: hits, missed: q.keywords.filter((k) => !hits.includes(k)), modelAnswer: q.a };
  });
  const score = Math.round(review.reduce((a, r) => a + r.score, 0) / review.length);
  const a = await prisma.assessment.findUnique({ where: { slug: "mock-interview" } });
  if (a) await prisma.assessmentAttempt.create({ data: { userId: user.id, assessmentId: a.id, score, answers: body.answers as unknown as Prisma.InputJsonValue } });
  return { score, review };
});
