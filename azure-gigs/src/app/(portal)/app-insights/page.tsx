import { PageHeader } from "@/components/page";
import { Section } from "@/components/sections";
import { AppInsightsSummary } from "@/components/monitor-views";
export const metadata = { title: "Application Insights" };
export default function Page() {
  return <><PageHeader title="Application Insights" subtitle="Application performance monitoring for your web apps (request data is simulated)." crumbs={[{ label: "Application Insights" }]} /><div className="grid gap-4"><AppInsightsSummary /><Section which="appinsights" /></div></>;
}
