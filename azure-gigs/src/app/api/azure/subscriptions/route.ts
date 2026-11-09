import { withUser } from "@/lib/api";
import { listSubscriptions } from "@/lib/azure/real";

export const GET = withUser(async (req, { user }) => ({ subscriptions: await listSubscriptions(user.id, req.nextUrl.searchParams.get("account") ?? "") }), { limit: 60 });
