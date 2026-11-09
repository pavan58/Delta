import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { disconnect, listAccounts, realAzureConfigured } from "@/lib/azure/real";

export const GET = withUser(async (_req, { user }) => ({ configured: realAzureConfigured(), accounts: await listAccounts(user.id) }));
export const DELETE = withUser(async (req, { user }) => {
  const { accountId } = z.object({ accountId: z.string() }).parse(await readJson(req));
  await disconnect(user.id, accountId);
  return { ok: true };
});
