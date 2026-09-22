import { handle, readBody } from "@/lib/server/route-utils";
import { FeedbackSchema } from "@/lib/server/validation";
import { track } from "@/lib/server/analytics";

// Aggregate, anonymous signal only (brand + outcome). The full record stays with the user.
export const POST = handle(async (req) => {
  const f = await readBody(req, FeedbackSchema);
  track({ type: "feedback", brand: f.brand, outcome: f.outcome, at: new Date().toISOString() });
  return { ok: true };
});
