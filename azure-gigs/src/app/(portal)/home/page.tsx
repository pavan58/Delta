import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NAV } from "@/components/nav";
import { NavIcon } from "@/components/icons";
import { Badge, Card, CardHeader, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { TYPE_LABELS, T } from "@/lib/sim/types";
import { COMPANY } from "@/content/paths";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Home" };

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { welcome } = await searchParams;
  const [recent, incidents, inProgress, sub] = await Promise.all([
    prisma.simulatedResource.findMany({ where: { userId: user.id, type: { notIn: [T.ENTRA_USER, T.ENTRA_GROUP, T.ROLE_ASSIGNMENT, T.ENTRA_SP, T.NIC, T.DISK, T.PIP] } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.incident.findMany({ where: { userId: user.id, status: "Open" }, orderBy: { createdAt: "desc" } }),
    prisma.userProgress.findMany({ where: { userId: user.id, status: "started" }, include: { lab: true }, take: 4, orderBy: { startedAt: "desc" } }),
    prisma.subscription.findFirst({ where: { userId: user.id } }),
  ]);
  const quick = ["rgs", "vms", "storage", "vnets", "nsgs", "entra", "apps", "kv", "monitor", "devops", "containers", "terminal"].map((k) => NAV.find((n) => n.key === k)!);
  return (
    <div className="grid gap-6">
      {welcome && (
        <Card className="border-brand bg-brand-bg p-4">
          <p className="font-semibold text-ink">Welcome to Contoso Digital Services, {user.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-ink">You joined as a <strong>Junior Azure Cloud Engineer</strong>. Your mentor, {COMPANY.mentor.name} ({COMPANY.mentor.title}), suggests starting with the lab <Link className="text-brand underline" href="/labs/create-resource-group">Create a tagged resource group</Link>, then the end-to-end <Link className="text-brand underline" href="/labs/web-vm-nsg-troubleshooting">web VM troubleshooting lab</Link>.</p>
        </Card>
      )}
      <section aria-labelledby="svc">
        <h2 id="svc" className="mb-2 text-base font-semibold">Azure services</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
          {quick.map((n) => (
            <Link key={n.key} href={n.href} className="flex flex-col items-center gap-2 rounded-sm p-3 text-center text-xs text-ink hover:bg-surface hover:shadow-sm">
              <NavIcon name={n.icon} className="size-7 text-brand" />
              <span>{n.label}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent resources" actions={<Link href="/resource-groups" className="text-sm text-brand">See all</Link>} />
          <Table><thead><tr><Th>Name</Th><Th>Type</Th><Th>Resource group</Th><Th>Last updated</Th></tr></thead><tbody>
            {recent.map((r) => <tr key={r.id}><Td><Link className="text-brand hover:underline" href={`/resources/${r.id}`}>{r.name}</Link></Td><Td>{TYPE_LABELS[r.type] ?? r.type}</Td><Td>{r.resourceGroup}</Td><Td>{timeAgo(r.updatedAt)}</Td></tr>)}
            {!recent.length && <tr><Td colSpan={4} className="text-muted">No resources yet - create a resource group to get started.</Td></tr>}
          </tbody></Table>
        </Card>
        <div className="grid gap-4">
          <Card><CardHeader title="Open incidents" actions={<Link href="/interview" className="text-sm text-brand">Incidents</Link>} />
            <ul className="divide-y divide-line">{incidents.map((i) => <li key={i.id} className="px-4 py-2 text-sm"><Badge color={statusColor(i.severity)}>{i.severity}</Badge> <Link className="text-brand hover:underline" href={`/interview?incident=${i.id}`}>{i.ticketNumber}: {i.title}</Link></li>)}{!incidents.length && <li className="px-4 py-3 text-sm text-muted">No open incidents. Calm on-call shift.</li>}</ul>
          </Card>
          <Card><CardHeader title="Labs in progress" />
            <ul className="divide-y divide-line">{inProgress.map((p) => <li key={p.id} className="px-4 py-2 text-sm"><Link className="text-brand hover:underline" href={`/labs/${p.lab.slug}`}>{p.lab.title}</Link></li>)}{!inProgress.length && <li className="px-4 py-3 text-sm text-muted"><Link className="text-brand" href="/labs">Browse 110 hands-on labs →</Link></li>}</ul>
          </Card>
          <Card className="p-4 text-xs text-muted">Subscription: <span className="font-mono">{sub?.displayName}</span><br /><span className="font-mono">{sub?.subscriptionId}</span><br />Virtual Azure Mode - simulated resources do not run in Microsoft Azure.</Card>
        </div>
      </div>
    </div>
  );
}
