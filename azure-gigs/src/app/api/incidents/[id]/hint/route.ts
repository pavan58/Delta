import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { takeHint } from "@/lib/labs/incidents";

type P = { params: Promise<{ id: string }> };
export const POST = withUser<P>(async (_req, { params, user }) => ({ incident: await takeHint(ctxOf(user), (await params).id) }));
