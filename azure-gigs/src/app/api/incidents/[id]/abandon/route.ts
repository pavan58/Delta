import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { abandonIncident } from "@/lib/labs/incidents";

type P = { params: Promise<{ id: string }> };
export const POST = withUser<P>(async (_req, { params, user }) => abandonIncident(ctxOf(user), (await params).id));
