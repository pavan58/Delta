import { NextResponse, type NextRequest } from "next/server";
import { checkOrigin, clientIp, errorResponse, readJson } from "@/lib/api";
import { registerUser } from "@/lib/auth/users";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rateLimit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const rl = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
    if (!rl.ok) throw new AppError(429, "TooManyRequests", "Too many registrations from this address. Try again later.");
    const user = await registerUser((await readJson(req)) as never);
    const { token, maxAge } = await createSession(user.id, req.headers.get("user-agent") ?? undefined);
    await prisma.auditLog.create({ data: { userId: user.id, action: "auth.register", ip: clientIp(req) } });
    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
