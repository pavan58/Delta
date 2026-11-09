import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { startLab } from "@/lib/labs/grader";

type P = { params: Promise<{ slug: string }> };
export const POST = withUser<P>(async (_req, { params, user }) => startLab(ctxOf(user), (await params).slug), { limit: 30 });
