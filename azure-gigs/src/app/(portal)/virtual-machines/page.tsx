import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Virtual machines" };
export default function Page() {
  return <><PageHeader title="Virtual machines" subtitle="Create, configure, start, stop and troubleshoot simulated VMs." crumbs={[{ label: "Virtual machines" }]} /><Section which="vms" /></>;
}
