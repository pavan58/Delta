import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Key vaults" };
export default function Page() {
  return <><PageHeader title="Key vaults" subtitle="Secrets with versions, access policies or RBAC, retrieval tests and audit history." crumbs={[{ label: "Key vaults" }]} /><Section which="kv" /></>;
}
