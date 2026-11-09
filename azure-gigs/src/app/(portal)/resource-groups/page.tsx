import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Resource groups" };
export default function Page() {
  return <><PageHeader title="Resource groups" subtitle="Logical containers for resources that share a lifecycle." crumbs={[{ label: "Resource groups" }]} /><Section which="rgs" /></>;
}
