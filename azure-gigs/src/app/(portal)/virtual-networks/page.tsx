import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Virtual networks" };
export default function Page() {
  return <><PageHeader title="Virtual networks" subtitle="Address spaces, subnets, peering and DNS - overlapping ranges are validated." crumbs={[{ label: "Virtual networks" }]} /><Section which="vnets" /></>;
}
