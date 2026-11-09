import { NextResponse, type NextRequest } from "next/server";
import { checkOrigin, errorResponse } from "@/lib/api";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
