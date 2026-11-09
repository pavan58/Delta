import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { runTerminal } from "@/lib/terminal";
import { prisma } from "@/lib/db";

export const POST = withUser(async (req, { user }) => {
  const body = z.object({ shell: z.enum(["az", "pwsh", "bash"]), command: z.string().max(4000) }).parse(await readJson(req));
  return runTerminal(ctxOf(user, body.shell === "az" ? "cli" : body.shell === "pwsh" ? "pwsh" : "bash"), body.shell, body.command);
}, { limit: 120 });

export const GET = withUser(async (req, { user }) => {
  const shell = req.nextUrl.searchParams.get("shell") ?? undefined;
  const rows = await prisma.commandHistory.findMany({ where: { userId: user.id, ...(shell ? { shell } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
  return { history: rows.map((r) => ({ id: r.id, shell: r.shell, command: r.command, exitCode: r.exitCode, durationMs: r.durationMs, changes: r.changes, createdAt: r.createdAt })) };
});
