import { withUser } from "@/lib/api";
import { dashboard } from "@/lib/labs/progress";

export const GET = withUser(async (_req, { user }) => dashboard(user.id));
