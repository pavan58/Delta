import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { buildAuthorizeUrl } from "@/lib/azure/real";

export const GET = withUser(async () => {
  const { url, state, verifier } = buildAuthorizeUrl();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/api/azure", maxAge: 600 };
  res.cookies.set("ag_oauth_state", state, opts);
  res.cookies.set("ag_oauth_verifier", verifier, opts);
  return res;
});
