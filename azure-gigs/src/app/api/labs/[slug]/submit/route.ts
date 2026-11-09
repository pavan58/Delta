import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { submitLab } from "@/lib/labs/grader";

type P = { params: Promise<{ slug: string }> };
export const POST = withUser<P>(async (req, { params, user }) => submitLab(ctxOf(user, "system"), (await params).slug, await readJson(req)), { limit: 30 });
