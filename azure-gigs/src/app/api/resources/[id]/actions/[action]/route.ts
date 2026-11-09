import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { getById, Props } from "@/lib/sim/engine";
import { runAction, sanitize } from "@/lib/sim/registry";

type P = { params: Promise<{ id: string; action: string }> };

export const POST = withUser<P>(async (req, { params, user }) => {
  const ctx = ctxOf(user);
  const { id, action } = await params;
  const r = await getById(ctx, id);
  const out = (await runAction(ctx, r, action, (await readJson(req)) as Props)) as Props;
  // Never echo raw resource rows with secret material back to the client.
  if (out && typeof out === "object" && "userId" in out && "properties" in out) return { resource: sanitize(out as never) };
  if (out && typeof out === "object" && "vm" in out) return { ...out, vm: sanitize(out.vm as never) };
  if (out && typeof out === "object" && "site" in out) return { ...out, site: undefined };
  if (out && typeof out === "object" && "registry" in out) return { ...out, registry: undefined };
  if (out && typeof out === "object" && "project" in out) return { ...out, project: undefined };
  return { result: out ?? null };
}, { limit: 180 });
