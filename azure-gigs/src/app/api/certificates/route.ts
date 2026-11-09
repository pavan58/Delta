import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { issueCertificate } from "@/lib/labs/progress";

export const POST = withUser(async (req, { user }) => {
  const { path } = z.object({ path: z.string() }).parse(await readJson(req));
  return { certificate: await issueCertificate(user.id, path) };
});
