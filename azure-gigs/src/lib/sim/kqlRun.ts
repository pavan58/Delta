import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { Ctx } from "./engine";
import { KqlError, runKql } from "./kql";
import { buildTables } from "./kqlData";

/** Runs a KQL query for a learner and records it in command history (shell "kql") for grading. */
export async function runKqlForUser(ctx: Ctx, query: string) {
  if (!query.trim()) throw badRequest("EmptyQuery", "Query is empty.");
  const started = Date.now();
  try {
    const r = runKql(query, await buildTables(ctx));
    await prisma.commandHistory.create({ data: { userId: ctx.userId, shell: "kql", command: query.slice(0, 4000), stdout: `${r.rows.length} rows`, stderr: "", exitCode: 0, durationMs: Date.now() - started } });
    return { ok: true as const, ...r };
  } catch (e) {
    if (!(e instanceof KqlError)) throw e;
    await prisma.commandHistory.create({ data: { userId: ctx.userId, shell: "kql", command: query.slice(0, 4000), stdout: "", stderr: e.message, exitCode: 1, durationMs: Date.now() - started } });
    return { ok: false as const, error: e.message };
  }
}
