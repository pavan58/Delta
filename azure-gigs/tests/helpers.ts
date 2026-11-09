import { randomUUID } from "node:crypto";
import { registerUser } from "@/lib/auth/users";
import type { Ctx } from "@/lib/sim/engine";

export async function newLearner(name = "Test Learner") {
  const email = `t-${randomUUID().slice(0, 8)}@example.com`;
  const user = await registerUser({ name, email, password: "Sup3rSecretPass" });
  const ctx: Ctx = { userId: user.id, caller: user.email, source: "portal" };
  return { user, ctx };
}
