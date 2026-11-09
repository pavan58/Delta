import { PageHeader } from "@/components/page";
import { CostView } from "@/components/monitor-views";
export const metadata = { title: "Cost Management" };
export default function Page() {
  return <><PageHeader title="Cost Management" subtitle="Estimated spend by resource group and service, with budgets and alert thresholds." crumbs={[{ label: "Cost Management" }]} /><CostView /></>;
}
