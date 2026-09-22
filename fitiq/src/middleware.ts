import { NextResponse, type NextRequest } from "next/server";

// Admin protection. When ADMIN_TOKEN is set, /admin and /api/admin require it
// (cookie "fitiq_admin" or "Authorization: Bearer <token>"). In production an
// unset ADMIN_TOKEN locks admin entirely.
export function middleware(req: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  const isProd = process.env.NODE_ENV === "production";
  if (!token && !isProd) return NextResponse.next();
  if (!token) return new NextResponse("Admin disabled: set ADMIN_TOKEN", { status: 403 });
  const url = req.nextUrl;
  const q = url.searchParams.get("token");
  if (q === token) {
    const res = NextResponse.redirect(new URL(url.pathname, req.url));
    res.cookies.set("fitiq_admin", token, { httpOnly: true, sameSite: "strict", secure: isProd, path: "/" });
    return res;
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (req.cookies.get("fitiq_admin")?.value === token || bearer === token) return NextResponse.next();
  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
