import { z } from "zod";
import { runJob } from "@/lib/jobs";
import { handle, readBody } from "@/lib/server/route-utils";

const Body = z.object({ job: z.enum(["sync-products", "sync-prices", "compute-trends", "generate-recommendations"]) });

export const POST = handle(async (req) => runJob((await readBody(req, Body)).job));
