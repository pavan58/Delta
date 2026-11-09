import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Function App" };
export default function Page() {
  return <><PageHeader title="Function App" subtitle="HTTP-triggered functions from safe templates; test with keys and view execution logs." crumbs={[{ label: "Function App" }]} /><Section which="functions" /></>;
}
