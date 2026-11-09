import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
export const metadata = { title: "Backup center" };
export default function Page() {
  return <><PageHeader title="Backup center" subtitle="Recovery Services vaults, policies, on-demand backups and VM restore." crumbs={[{ label: "Backup center" }]} /><Section which="backup" /></>;
}
