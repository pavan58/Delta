import { withUser, readJson } from "@/lib/api";
import { createResourceGroup, deleteResourceGroup, listResourceGroups } from "@/lib/azure/real";

export const GET = withUser(async (req, { user }) => ({ resourceGroups: await listResourceGroups(user.id, req.nextUrl.searchParams.get("account") ?? "", req.nextUrl.searchParams.get("subscription") ?? "") }), { limit: 60 });
export const POST = withUser(async (req, { user }) => {
  const body = (await readJson(req)) as { account?: string };
  return { resourceGroup: await createResourceGroup(user.id, String(body.account ?? ""), body) };
}, { limit: 20 });
export const DELETE = withUser(async (req, { user }) => {
  const body = (await readJson(req)) as { account?: string };
  return deleteResourceGroup(user.id, String(body.account ?? ""), body);
}, { limit: 20 });
