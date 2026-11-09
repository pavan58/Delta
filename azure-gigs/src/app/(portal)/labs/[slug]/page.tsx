import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LAB_BY_SLUG } from "@/content/labs";
import { PageHeader } from "@/components/page";
import { LabRunner } from "@/components/learning";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const lab = LAB_BY_SLUG.get(slug);
  const row = await prisma.lab.findUnique({ where: { slug } });
  if (!lab || !row) notFound();
  const progress = await prisma.userProgress.findUnique({ where: { userId_labId: { userId: user.id, labId: row.id } } });
  const last = await prisma.labSubmission.findFirst({ where: { userId: user.id, labId: row.id }, include: { score: true }, orderBy: { createdAt: "desc" } });
  const lastScore = last?.score ? { total: last.score.total, passed: last.score.passed, scores: { configuration: last.score.configuration, execution: last.score.execution, security: last.score.security, documentation: last.score.documentation }, results: (last.score.results as { checks: unknown[] }).checks, suggestions: (last.score.results as { suggestions: string[] }).suggestions, solution: last.score.passed ? lab.solution : null } : null;
  // The solution is only sent after the learner passes (or asks for it after completion).
  const { solution, ...safe } = lab;
  return <><PageHeader title={lab.title} crumbs={[{ label: "My Labs", href: "/labs" }, { label: lab.title }]} /><LabRunner lab={{ ...safe, solution: progress?.status === "completed" ? solution : "Complete the lab to unlock the solution." }} progress={progress ? JSON.parse(JSON.stringify(progress)) : null} lastScore={lastScore} /></>;
}
