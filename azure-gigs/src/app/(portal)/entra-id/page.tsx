import { PageHeader } from "@/components/page";
import { EntraView } from "@/components/entra-view";
export const metadata = { title: "Microsoft Entra ID" };
export default function Page() {
  return <><PageHeader title="Microsoft Entra ID (simulated directory)" subtitle="Contoso Digital Services tenant: users, groups, RBAC role assignments, access checks, sign-in and audit logs." crumbs={[{ label: "Microsoft Entra ID" }]} /><EntraView /></>;
}
