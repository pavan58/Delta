import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "App Services" };
export default function Page() {
  return <><PageHeader title="App Services" subtitle="Create a plan first, then web apps on it. Deploy sample packages and browse." crumbs={[{ label: "App Services" }]} /><Section which="apps" /></>;
}
