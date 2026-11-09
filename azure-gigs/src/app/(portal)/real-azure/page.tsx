import { PageHeader } from "@/components/page";
import { RealAzure } from "@/components/real-azure";
export const metadata = { title: "Real Azure Mode" };
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <><PageHeader title="Real Azure Mode" subtitle="Connect your own subscription with Microsoft sign-in to list, create and clean up real resources." crumbs={[{ label: "Real Azure Mode" }]} /><RealAzure status={status} /></>;
}
