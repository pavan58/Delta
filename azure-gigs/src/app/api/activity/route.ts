import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = withUser(async (req, { user }) => {
  const q = req.nextUrl.searchParams;
  const resourceId = q.get("resourceId") ?? undefined;
  const take = Math.min(Number(q.get("take") ?? 100), 500);
  const logs = await prisma.activityLog.findMany({ where: { userId: user.id, ...(resourceId ? { resourceId } : {}), ...(q.get("resourceGroup") ? { resourceGroup: { equals: q.get("resourceGroup")!, mode: "insensitive" } } : {}) }, orderBy: { createdAt: "desc" }, take });
  return { logs };
});
