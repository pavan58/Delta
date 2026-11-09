import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { costSummary } from "@/lib/sim/services/monitor";

export const GET = withUser(async (_req, { user }) => costSummary(ctxOf(user)));
