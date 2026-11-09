import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { testAccess } from "@/lib/sim/services/rbac";

export const POST = withUser(async (req, { user }) => testAccess(ctxOf(user), await readJson(req)));
