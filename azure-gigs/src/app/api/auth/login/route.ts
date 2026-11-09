import { NextResponse, type NextRequest } from "next/server";
import { checkOrigin, clientIp, errorResponse, readJson } from "@/lib/api";
import { authenticate, touchActivity } from "@/lib/auth/users";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rateLimit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const ip = clientIp(req);
    const rl = rateLimit(`login:${ip}`, 20, 15 * 60_000);
    if (!rl.ok) throw new AppError(429, "TooManyRequests", `Too many sign-in attempts. Retry in ${rl.retryAfter}s.`);
    const body = (await readJson(req)) as { email?: string; password?: string };
    let user;
    try {
      user = await authenticate(body as never);
    } catch (e) {
      await prisma.auditLog.create({ data: { action: "auth.login.failed", ip, details: { email: String(body.email ?? "").slice(0, 200) } } });
      throw e;
    }
    const { token, maxAge } = await createSession(user.id, req.headers.get("user-agent") ?? undefined);
    await prisma.auditLog.create({ data: { userId: user.id, action: "auth.login", ip } });
    await touchActivity(user.id);
    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
