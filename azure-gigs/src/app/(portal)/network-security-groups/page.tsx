import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Network security groups" };
export default function Page() {
  return <><PageHeader title="Network security groups" subtitle="Inbound/outbound rules evaluated by priority, with IP flow verify." crumbs={[{ label: "Network security groups" }]} /><Section which="nsgs" /></>;
}
