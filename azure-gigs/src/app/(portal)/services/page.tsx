import Link from "next/link";
import { NAV } from "@/components/nav";
import { NavIcon } from "@/components/icons";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui/misc";
export const metadata = { title: "All services" };
const DESC: Record<string, string> = { rgs: "Organize resources by lifecycle", vms: "Linux and Windows virtual machines", storage: "Blobs, tiers, redundancy", vnets: "Address spaces, subnets, peering", nsgs: "Allow/deny network rules", entra: "Users, groups, RBAC", apps: "Managed web hosting", functions: "Serverless HTTP functions", sql: "Managed relational databases", kv: "Secrets management", monitor: "Health, metrics, alerts", logs: "KQL queries", appinsights: "App performance", devops: "Boards, repos, pipelines", containers: "ACR, ACI, AKS", backup: "Backup & restore", cost: "Budgets & spend", terminal: "CLI, PowerShell, Bash", learning: "Learning paths", labs: "110 graded labs", interview: "Incidents & mock interviews", company: "Contoso onboarding", real: "Connect a real subscription" };
export default function Page() {
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <>
      <PageHeader title="All services" subtitle="Every service below opens a working page. Use Create on any list to deploy simulated resources." crumbs={[{ label: "All services" }]} />
      <div className="grid gap-6">{groups.map((g) => (
        <section key={g}><h2 className="mb-2 text-sm font-semibold text-muted">{g}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{NAV.filter((n) => n.group === g).map((n) => (
            <Link key={n.key} href={n.href}><Card className="flex items-start gap-3 p-3 hover:border-brand"><NavIcon name={n.icon} className="mt-0.5 size-5 text-brand" /><div><p className="text-sm font-semibold text-ink">{n.label}</p><p className="text-xs text-muted">{DESC[n.key] ?? ""}</p></div></Card></Link>
          ))}</div>
        </section>
      ))}</div>
    </>
  );
}
