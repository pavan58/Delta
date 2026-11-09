import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Containers" };
export default function Page() {
  return <><PageHeader title="Containers" subtitle="Container Registry builds, Container Instances and Kubernetes clusters (use kubectl in the Cloud terminal)." crumbs={[{ label: "Containers" }]} /><Section which="containers" /></>;
}
