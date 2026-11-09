import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Azure SQL" };
export default function Page() {
  return <><PageHeader title="Azure SQL" subtitle="Servers, firewall rules and databases with a sandboxed query editor." crumbs={[{ label: "Azure SQL" }]} /><Section which="sql" /></>;
}
