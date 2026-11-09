import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userFromToken } from "@/lib/auth/session";
import { completeOAuth } from "@/lib/azure/real";
import { safeEqual } from "@/lib/security/crypto";

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const back = (msg: string) => NextResponse.redirect(`${base}/real-azure?status=${encodeURIComponent(msg)}`);
  const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.redirect(`${base}/login`);
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(`Microsoft sign-in failed: ${q.get("error_description") ?? q.get("error")}`.slice(0, 300));
  const state = req.cookies.get("ag_oauth_state")?.value;
  const verifier = req.cookies.get("ag_oauth_verifier")?.value;
  if (!state || !verifier || !q.get("state") || !safeEqual(state, q.get("state")!)) return back("Invalid OAuth state. Please try again.");
  try {
    await completeOAuth(user.id, q.get("code") ?? "", verifier);
    const res = back("connected");
    res.cookies.set("ag_oauth_state", "", { path: "/api/azure", maxAge: 0 });
    res.cookies.set("ag_oauth_verifier", "", { path: "/api/azure", maxAge: 0 });
    return res;
  } catch (e) {
    return back((e as Error).message.slice(0, 300));
  }
}
