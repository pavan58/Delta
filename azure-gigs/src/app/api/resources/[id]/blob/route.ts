import { withUser } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { getById } from "@/lib/sim/engine";
import { downloadBlob } from "@/lib/sim/services/storage";
import { badRequest } from "@/lib/errors";

type P = { params: Promise<{ id: string }> };

export const GET = withUser<P>(async (req, { params, user }) => {
  const ctx = ctxOf(user);
  const sa = await getById(ctx, (await params).id);
  const container = req.nextUrl.searchParams.get("container");
  const name = req.nextUrl.searchParams.get("name");
  if (!container || !name) throw badRequest("MissingParameter", "container and name are required.");
  const b = await downloadBlob(ctx, sa, container, name);
  return new Response(new Uint8Array(b.content), {
    headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${encodeURIComponent(name.split("/").pop() ?? "blob")}"`, "x-content-type-options": "nosniff" },
  });
});
