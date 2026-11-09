import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { runKqlForUser } from "@/lib/sim/kqlRun";

export const POST = withUser(async (req, { user }) => {
  const { query } = z.object({ query: z.string().max(5000) }).parse(await readJson(req));
  return runKqlForUser(ctxOf(user), query);
}, { limit: 60 });
