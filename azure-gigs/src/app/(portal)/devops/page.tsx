import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Azure DevOps" };
export default function Page() {
  return <><PageHeader title="Azure DevOps" subtitle="Projects with Boards, Repos, pull requests, YAML pipelines, environments and service connections. Pipelines really deploy to your simulated resources." crumbs={[{ label: "Azure DevOps" }]} /><Section which="devops" /></>;
}
