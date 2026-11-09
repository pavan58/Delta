import type { User } from "@prisma/client";
import type { Ctx, Source } from "@/lib/sim/engine";
import { touchActivity } from "@/lib/auth/users";

export function ctxOf(user: User, source: Source = "portal"): Ctx {
  void touchActivity(user.id).catch(() => undefined);
  return { userId: user.id, caller: user.email, source };
}
