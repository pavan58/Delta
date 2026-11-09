import { PageHeader } from "@/components/page";
import { MonitorView } from "@/components/monitor-views";
export const metadata = { title: "Monitor" };
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <><PageHeader title="Monitor" subtitle="Resource health, metrics, alert rules and the subscription activity log." crumbs={[{ label: "Monitor" }]} /><MonitorView initialTab={tab === "activity" ? "Activity log" : undefined} /></>;
}
