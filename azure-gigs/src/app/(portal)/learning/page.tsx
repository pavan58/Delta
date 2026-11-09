import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { dashboard } from "@/lib/labs/progress";
import { PATHS } from "@/content/paths";
import { PageHeader } from "@/components/page";
import { Badge, Card } from "@/components/ui/misc";
import { Progress } from "@/components/charts";
export const metadata = { title: "Learning Center" };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const d = await dashboard(user.id);
  return (
    <>
      <PageHeader title="Learning Center" subtitle="Seven role-based learning paths with modules, graded labs, assessments and capstone projects." crumbs={[{ label: "Learning Center" }]} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PATHS.map((p) => {
          const s = d.paths.find((x) => x.slug === p.slug)!;
          return (
            <Link key={p.slug} href={`/learning/${p.slug}`}><Card className="grid h-full gap-2 p-4 hover:border-brand">
              <div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-ink">{p.title}</h2><Badge color="blue">{p.level}</Badge></div>
              <p className="text-sm text-muted">{p.description}</p>
              <p className="text-xs text-muted">{p.modules.length} modules · {s.total} labs · {p.assessment.length}-question assessment</p>
              <Progress value={s.percent} label="Progress" />
            </Card></Link>
          );
        })}
      </div>
    </>
  );
}
