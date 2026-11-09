import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { resolveIncident } from "@/lib/labs/incidents";

type P = { params: Promise<{ id: string }> };
export const POST = withUser<P>(async (req, { params, user }) => resolveIncident(ctxOf(user, "system"), (await params).id, await readJson(req)), { limit: 30 });
