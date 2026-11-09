import { withUser } from "@/lib/api";
import { listResources } from "@/lib/azure/real";

export const GET = withUser(async (req, { user }) => {
  const q = req.nextUrl.searchParams;
  return { resources: await listResources(user.id, q.get("account") ?? "", q.get("subscription") ?? "", q.get("resourceGroup") ?? "") };
}, { limit: 60 });
