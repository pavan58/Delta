import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { injectIncident, publicIncident } from "@/lib/labs/incidents";
import { prisma } from "@/lib/db";

export const GET = withUser(async (_req, { user }) => {
  const rows = await prisma.incident.findMany({ where: { userId: user.id }, include: { resolution: true }, orderBy: { createdAt: "desc" } });
  return { incidents: rows.map(publicIncident) };
});

export const POST = withUser(async (req, { user }) => {
  const { faultType } = z.object({ faultType: z.string().optional() }).parse(await readJson(req));
  const i = await injectIncident(ctxOf(user), faultType || undefined);
  return Response.json({ incident: publicIncident(i) }, { status: 201 });
}, { limit: 20 });
