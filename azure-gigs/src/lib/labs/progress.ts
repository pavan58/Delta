/** Learner progress, dashboard statistics, assessments and certificates. */
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { LABS } from "@/content/labs";
import { PATHS } from "@/content/paths";

export async function pathProgress(userId: string, slug: string) {
  const path = await prisma.learningPath.findUnique({ where: { slug }, include: { modules: { orderBy: { order: "asc" }, include: { labs: { orderBy: { order: "asc" }, include: { lab: true } }, assessments: true } } } });
  if (!path) throw notFound(`Learning path '${slug}' not found.`);
  const progress = await prisma.userProgress.findMany({ where: { userId } });
  const byLab = new Map(progress.map((p) => [p.labId, p]));
  const modules = path.modules.map((m) => ({
    slug: m.slug,
    title: m.title,
    description: m.description,
    labs: m.labs.map((ml) => ({ slug: ml.lab.slug, title: ml.lab.title, difficulty: ml.lab.difficulty, durationMinutes: ml.lab.durationMinutes, isCapstone: ml.lab.isCapstone, status: byLab.get(ml.labId)?.status ?? "not started", bestScore: byLab.get(ml.labId)?.bestScore ?? 0 })),
  }));
  const allLabs = [...new Map(modules.flatMap((m) => m.labs).map((l) => [l.slug, l])).values()];
  const completed = allLabs.filter((l) => l.status === "completed").length;
  const assessment = await prisma.assessment.findUnique({ where: { slug: `${slug}-assessment` } });
  const best = assessment ? await prisma.assessmentAttempt.findFirst({ where: { userId, assessmentId: assessment.id }, orderBy: { score: "desc" } }) : null;
  const cert = await prisma.certificate.findUnique({ where: { userId_pathId: { userId, pathId: path.id } } });
  const labPct = allLabs.length ? completed / allLabs.length : 0;
  return {
    slug: path.slug, title: path.title, description: path.description, level: path.level, modules,
    totals: { labs: allLabs.length, completed, percent: Math.round(labPct * 100) },
    assessment: assessment ? { slug: assessment.slug, passMark: assessment.passMark, best: best?.score ?? null, questions: (assessment.questions as Prisma.JsonArray).length } : null,
    certificate: cert,
    eligible: labPct >= 0.8 && !!best && !!assessment && best.score >= assessment.passMark,
  };
}

export async function dashboard(userId: string) {
  const [user, progress, submissions, incidents, attempts, certs, commands, resources] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.userProgress.findMany({ where: { userId }, include: { lab: true } }),
    prisma.labSubmission.findMany({ where: { userId }, include: { score: true, lab: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.incident.findMany({ where: { userId }, include: { resolution: true }, orderBy: { createdAt: "desc" } }),
    prisma.assessmentAttempt.findMany({ where: { userId }, include: { assessment: true }, orderBy: { createdAt: "desc" } }),
    prisma.certificate.findMany({ where: { userId }, include: { path: true } }),
    prisma.commandHistory.count({ where: { userId } }),
    prisma.simulatedResource.count({ where: { userId } }),
  ]);
  const completed = progress.filter((p) => p.status === "completed");
  const categories = [...new Set(LABS.map((l) => l.category))];
  const skills = categories.map((cat) => {
    const total = LABS.filter((l) => l.category === cat).length;
    const done = completed.filter((p) => p.lab.category === cat).length;
    return { skill: cat, total, completed: done, percent: Math.round((done / total) * 100), level: done === 0 ? "Not started" : done / total >= 0.6 ? "Mastered" : done / total >= 0.25 ? "Practicing" : "Beginner" };
  });
  const scored = submissions.filter((s) => s.score);
  const avgScore = completed.length ? Math.round(completed.reduce((a, p) => a + p.bestScore, 0) / completed.length) : 0;
  const resolved = incidents.filter((i) => i.resolution);
  const incidentAvg = resolved.length ? resolved.reduce((a, i) => a + (i.resolution?.score ?? 0), 0) / resolved.length : 0;
  const assessAvg = attempts.length ? attempts.reduce((a, x) => a + x.score, 0) / attempts.length : 0;
  const readiness = Math.round(Math.min(100, (Math.min(completed.length, 30) / 30) * 40 + (incidentAvg / 100) * Math.min(resolved.length, 5) / 5 * 35 + (assessAvg / 100) * 25));
  const pathStats = [];
  for (const p of PATHS) {
    const labs = [...new Set(p.modules.flatMap((m) => m.labs))];
    const done = labs.filter((s) => completed.some((c) => c.lab.slug === s)).length;
    pathStats.push({ slug: p.slug, title: p.title, percent: Math.round((done / labs.length) * 100), completed: done, total: labs.length });
  }
  const current = [...pathStats].sort((a, b) => b.percent - a.percent)[0];
  return {
    user: { name: user.name, email: user.email, streakDays: user.streakDays, memberSince: user.createdAt },
    labs: { completed: completed.length, total: LABS.length, started: progress.filter((p) => p.status === "started").length, averageScore: avgScore },
    capstones: completed.filter((p) => p.lab.isCapstone).length,
    skills,
    skillsMastered: skills.filter((s) => s.level === "Mastered").map((s) => s.skill),
    skillsPending: skills.filter((s) => s.level === "Not started").map((s) => s.skill),
    recentScores: scored.map((s) => ({ lab: s.lab.title, slug: s.lab.slug, score: s.score!.total, passed: s.score!.passed, at: s.createdAt })),
    incidents: { total: incidents.length, resolved: resolved.length, open: incidents.filter((i) => i.status === "Open").length, averageScore: Math.round(incidentAvg) },
    assessments: attempts.slice(0, 5).map((a) => ({ title: a.assessment.title, score: a.score, at: a.createdAt })),
    interviewReadiness: readiness,
    paths: pathStats,
    currentPath: current?.percent ? current : pathStats[0],
    certificates: certs.map((c) => ({ id: c.certificateId, path: c.path.title, issuedAt: c.issuedAt, score: c.score })),
    activity: { commands, resources },
  };
}

export const answersSchema = z.object({ answers: z.array(z.number().int().min(-1).max(10)).max(100) });

export async function submitAssessment(userId: string, slug: string, raw: unknown) {
  const { answers } = answersSchema.parse(raw);
  const a = await prisma.assessment.findUnique({ where: { slug } });
  if (!a) throw notFound("Assessment not found.");
  const qs = a.questions as { q: string; options: string[]; answer: number; explanation: string }[];
  const correct = qs.filter((q, i) => answers[i] === q.answer).length;
  const score = Math.round((correct / qs.length) * 100);
  await prisma.assessmentAttempt.create({ data: { userId, assessmentId: a.id, score, answers: answers as Prisma.InputJsonValue } });
  return { score, passed: score >= a.passMark, passMark: a.passMark, correct, total: qs.length, review: qs.map((q, i) => ({ q: q.q, yourAnswer: answers[i] ?? -1, correctAnswer: q.answer, correct: answers[i] === q.answer, explanation: q.explanation })) };
}

export async function issueCertificate(userId: string, pathSlug: string) {
  const p = await pathProgress(userId, pathSlug);
  if (p.certificate) return p.certificate;
  if (!p.eligible) throw conflict("NotEligible", `Complete at least 80% of the path's labs (${p.totals.completed}/${p.totals.labs}) and pass the assessment (best ${p.assessment?.best ?? "none"}/${p.assessment?.passMark}).`);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const path = await prisma.learningPath.findUniqueOrThrow({ where: { slug: pathSlug } });
  return prisma.certificate.create({
    data: { certificateId: `AG-${randomBytes(6).toString("hex").toUpperCase()}`, userId, pathId: path.id, learnerName: user.name, completedLabs: p.totals.completed, score: p.assessment?.best ?? 0 },
  });
}

export async function verifyCertificate(certificateId: string) {
  return prisma.certificate.findUnique({ where: { certificateId }, include: { path: true } });
}
