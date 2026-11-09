import { PageHeader } from "@/components/page";
import { Terminal } from "@/components/terminal";
export const metadata = { title: "Cloud terminal" };
export default function Page() {
  return <><PageHeader title="Cloud terminal" subtitle="Azure CLI, Azure PowerShell and Bash against your persistent simulated subscription. Use 'az login --username <user>' to act as a directory user with their RBAC permissions." crumbs={[{ label: "Cloud terminal" }]} /><Terminal /></>;
}
