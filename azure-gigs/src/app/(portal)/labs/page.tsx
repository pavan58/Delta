import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LABS } from "@/content/labs";
import { PageHeader } from "@/components/page";
import { LabCatalog } from "@/components/learning";
export const metadata = { title: "My Labs" };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const progress = await prisma.userProgress.findMany({ where: { userId: user.id }, include: { lab: { select: { slug: true } } } });
  const by = new Map(progress.map((p) => [p.lab.slug, p]));
  const labs = LABS.map((l) => ({ slug: l.slug, title: l.title, difficulty: l.difficulty, category: l.category, durationMinutes: l.durationMinutes, isCapstone: !!l.isCapstone, status: by.get(l.slug)?.status ?? "not started", bestScore: by.get(l.slug)?.bestScore ?? 0 }));
  return <><PageHeader title="My Labs" subtitle={`${LABS.length} hands-on labs graded automatically against your simulator state.`} crumbs={[{ label: "My Labs" }]} /><LabCatalog labs={labs} /></>;
}
