import Link from "next/link";
import { COMPANY } from "@/content/paths";
import { PageHeader } from "@/components/page";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui/misc";
export const metadata = { title: "Contoso workplace" };
export default function Page() {
  return (
    <>
      <PageHeader title={COMPANY.name} subtitle={`Your role: ${COMPANY.role} · Mentor: ${COMPANY.mentor.name}, ${COMPANY.mentor.title}`} crumbs={[{ label: "Contoso workplace" }]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Environments" /><Table><thead><tr><Th>Environment</Th><Th>Resource groups</Th><Th>Purpose</Th></tr></thead><tbody>{COMPANY.environments.map((e) => <tr key={e.name}><Td>{e.name}</Td><Td className="font-mono text-xs">{e.rg}</Td><Td>{e.purpose}</Td></tr>)}</tbody></Table></Card>
        <Card><CardHeader title="Teams" /><Table><thead><tr><Th>Team</Th><Th>Lead</Th><Th>Focus</Th></tr></thead><tbody>{COMPANY.teams.map((t) => <tr key={t.name}><Td>{t.name}</Td><Td>{t.lead}</Td><Td>{t.focus}</Td></tr>)}</tbody></Table></Card>
      </div>
      <Card className="mt-4"><CardHeader title="Your progression" subtitle="Observe → Shadow → Reverse shadow → Guided execution → Independent execution → Production support simulation" />
        <ol className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{COMPANY.progression.map((p, i) => <li key={p.stage} className="rounded-sm border border-line p-3"><p className="text-xs text-muted">Stage {i + 1}</p><p className="font-semibold">{p.stage}</p><p className="text-sm text-muted">{p.description}</p><ul className="mt-2 grid gap-1 text-sm">{p.labs.map((l) => <li key={l}><Link className="text-brand hover:underline" href={`/labs/${l}`}>{l}</Link></li>)}</ul></li>)}</ol>
      </Card>
      <Card className="mt-4"><CardHeader title="Knowledge transfer (KT) sessions" /><div className="grid gap-3 p-4 md:grid-cols-2">{COMPANY.kt.map((k) => <div key={k.title} className="rounded-sm border border-line p-3"><p className="font-semibold">{k.title}</p><p className="text-xs text-muted">Presenter: {k.presenter}</p><p className="mt-1 text-sm">{k.notes}</p></div>)}</div></Card>
      <Card className="mt-4 p-4 text-sm"><Badge color="blue">Policy</Badge> Production changes need a change request (Vikram Rao). Incidents are injected into <span className="font-mono">rg-contoso-prod</span> or your own resources; handle them from <Link className="text-brand underline" href="/interview">Interview Preparation</Link>.</Card>
    </>
  );
}
