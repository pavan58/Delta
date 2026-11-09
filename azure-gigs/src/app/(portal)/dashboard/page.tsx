import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { dashboard } from "@/lib/labs/progress";
import { PageHeader } from "@/components/page";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui/misc";
import { Progress } from "@/components/charts";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Learner dashboard" };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <Card className="p-4"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-semibold text-ink">{value}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</Card>;
}

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const d = await dashboard(user.id);
  return (
    <div>
      <PageHeader title="Learner dashboard" subtitle={`${d.user.name} · Junior Azure Cloud Engineer`} crumbs={[{ label: "Dashboard" }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Completed labs" value={`${d.labs.completed} / ${d.labs.total}`} sub={`${d.labs.started} in progress · avg best score ${d.labs.averageScore}`} />
        <Stat label="Learning streak" value={`${d.user.streakDays} day${d.user.streakDays === 1 ? "" : "s"}`} sub="Active days in a row" />
        <Stat label="Interview readiness" value={`${d.interviewReadiness}%`} sub={`${d.incidents.resolved} incidents resolved (avg ${d.incidents.averageScore})`} />
        <Stat label="Projects (capstones)" value={d.capstones} sub={`${d.certificates.length} certificate(s) earned`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Skill progression" subtitle="Based on labs passed (score ≥ 70) per skill area" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {d.skills.map((s) => <div key={s.skill}><Progress value={s.percent} label={`${s.skill} (${s.completed}/${s.total})`} /><p className="mt-0.5 text-[11px] text-muted">{s.level}</p></div>)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Current learning path" />
          <div className="grid gap-3 p-4">
            {d.currentPath && <><Link href={`/learning/${d.currentPath.slug}`} className="font-semibold text-brand hover:underline">{d.currentPath.title}</Link><Progress value={d.currentPath.percent} label={`${d.currentPath.completed}/${d.currentPath.total} labs`} /></>}
            <p className="text-xs font-semibold text-muted">Certification preparation</p>
            {d.paths.map((p) => <Progress key={p.slug} value={p.percent} label={p.title} />)}
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Recent lab scores" />
          <Table><thead><tr><Th>Lab</Th><Th>Score</Th><Th>Result</Th><Th>When</Th></tr></thead><tbody>{d.recentScores.map((s, i) => <tr key={i}><Td><Link className="text-brand hover:underline" href={`/labs/${s.slug}`}>{s.lab}</Link></Td><Td>{s.score}/100</Td><Td><Badge color={s.passed ? "green" : "red"}>{s.passed ? "Passed" : "Not yet"}</Badge></Td><Td>{timeAgo(s.at)}</Td></tr>)}{!d.recentScores.length && <tr><Td colSpan={4} className="text-muted">No submissions yet.</Td></tr>}</tbody></Table>
        </Card>
        <div className="grid gap-4">
          <Card className="p-4"><p className="text-xs font-semibold text-muted">Skills mastered</p><p className="mt-1 text-sm">{d.skillsMastered.join(", ") || "None yet"}</p><p className="mt-3 text-xs font-semibold text-muted">Skills pending</p><p className="mt-1 text-sm">{d.skillsPending.join(", ") || "None 🎉"}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold text-muted">Recent activity</p><p className="mt-1 text-sm">{d.activity.commands} terminal commands · {d.activity.resources} resources in your subscription</p>{d.assessments.map((a, i) => <p key={i} className="text-sm">{a.title}: {a.score}%</p>)}</Card>
          <Card className="p-4"><p className="text-xs font-semibold text-muted">Certificates</p>{d.certificates.map((c) => <p key={c.id} className="text-sm"><Link className="text-brand hover:underline" href={`/verify/${c.id}`}>{c.path}</Link></p>)}{!d.certificates.length && <p className="text-sm text-muted">Complete a learning path to earn one.</p>}</Card>
        </div>
      </div>
    </div>
  );
}
