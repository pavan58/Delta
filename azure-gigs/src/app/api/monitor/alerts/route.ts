import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { evaluateAlerts } from "@/lib/sim/services/monitor";

export const POST = withUser(async (_req, { user }) => ({ alerts: await evaluateAlerts(ctxOf(user, "system")) }));
