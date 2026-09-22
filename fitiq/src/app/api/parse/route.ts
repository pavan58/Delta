import { z } from "zod";
import { getAI } from "@/lib/ai";
import { handle, readBody } from "@/lib/server/route-utils";
import { wantsOutfit } from "@/lib/engines/nlp";

const Body = z.object({ text: z.string().min(1).max(300) });

export const POST = handle(async (req) => {
  const { text } = await readBody(req, Body);
  return { parsed: await getAI().parseQuery(text), outfit: wantsOutfit(text) };
});
