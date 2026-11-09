import { withUser, readJson } from "@/lib/api";
import { submitAssessment } from "@/lib/labs/progress";

type P = { params: Promise<{ slug: string }> };
export const POST = withUser<P>(async (req, { params, user }) => submitAssessment(user.id, (await params).slug, await readJson(req)), { limit: 30 });
