import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { pathProgress } from "@/lib/labs/progress";
import { PATHS } from "@/content/paths";
import { PageHeader } from "@/components/page";
import { PathDetail } from "@/components/learning";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const def = PATHS.find((p) => p.slug === slug);
  if (!def) notFound();
  const data = await pathProgress(user.id, slug);
  // Questions are sent without answers; grading happens server-side.
  const assessmentQuestions = def.assessment.map((q) => ({ q: q.q, options: q.options }));
  return <><PageHeader title={def.title} subtitle={def.description} crumbs={[{ label: "Learning Center", href: "/learning" }, { label: def.title }]} /><PathDetail data={{ ...JSON.parse(JSON.stringify(data)), assessmentQuestions }} /></>;
}
