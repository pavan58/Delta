import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { User } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE, userFromToken } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rateLimit";

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** CSRF defence: state-changing requests must come from our own origin. */
export function checkOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-browser clients (tests, curl) do not send Origin; browsers always do on POST/PATCH/DELETE.
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "CsrfRejected", "Cross-site request rejected.");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "CsrfRejected", "Invalid Origin header.");
  }
  if (originHost !== host) throw new AppError(403, "CsrfRejected", "Cross-origin request rejected.");
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  if (e instanceof ZodError) {
    const msg = e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: { code: "InvalidRequest", message: msg } }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: { code: "InternalError", message: "Unexpected server error." } }, { status: 500 });
}

type Handler<C> = (req: NextRequest, ctx: C & { user: User }) => Promise<Response | unknown>;

/** Wraps an authenticated API route: origin check, auth, rate limit, error mapping. */
export function withUser<C extends object>(handler: Handler<C>, opts: { limit?: number } = {}) {
  return async (req: NextRequest, ctx: C) => {
    try {
      checkOrigin(req);
      const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (!user) throw new AppError(401, "Unauthorized", "Sign in required.");
      // A global per-user budget plus a per-route-group budget (e.g. /api/incidents).
      const group = req.nextUrl.pathname.split("/").slice(0, 3).join("/");
      const global = rateLimit(`u:${user.id}`, 600, 60_000);
      const route = rateLimit(`u:${user.id}:${req.method}:${group}`, opts.limit ?? 240, 60_000);
      if (!global.ok || !route.ok) throw new AppError(429, "TooManyRequests", `Rate limit exceeded. Retry in ${Math.max(global.retryAfter, route.retryAfter)}s.`);
      const out = await handler(req, { ...ctx, user });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 1_000_000) throw new AppError(413, "PayloadTooLarge", "Request body too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "InvalidJson", "Request body is not valid JSON.");
  }
}
