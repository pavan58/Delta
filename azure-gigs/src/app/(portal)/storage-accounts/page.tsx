import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Storage accounts" };
export default function Page() {
  return <><PageHeader title="Storage accounts" subtitle="Blob containers, redundancy, access tiers, firewalls and access testing." crumbs={[{ label: "Storage accounts" }]} /><Section which="storage" /></>;
}
