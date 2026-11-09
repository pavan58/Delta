import { PageHeader } from "@/components/page";
import { KqlWorkbench } from "@/components/monitor-views";
import { Section } from "@/components/sections";
export const metadata = { title: "Log Analytics" };
export default function Page() {
  return <><PageHeader title="Log Analytics" subtitle="Run KQL against tables built from your own simulated environment (heartbeats, perf counters, syslog, requests, activity, sign-ins)." crumbs={[{ label: "Log Analytics" }]} /><div className="grid gap-4"><KqlWorkbench /><Section which="workspaces" /></div></>;
}
