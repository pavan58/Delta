import { withUser, readJson } from "@/lib/api";
import { createStorageAccount } from "@/lib/azure/real";

export const POST = withUser(async (req, { user }) => {
  const body = (await readJson(req)) as { account?: string };
  return { storageAccount: await createStorageAccount(user.id, String(body.account ?? ""), body) };
}, { limit: 10 });
