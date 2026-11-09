import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security/crypto";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "ag_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Creates a DB-backed session. Only the SHA-256 of the token is stored. */
export async function createSession(userId: string, userAgent?: string) {
  const token = randomToken();
  await prisma.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS), userAgent },
  });
  return { token, maxAge: SESSION_TTL_MS / 1000 };
}

export async function userFromToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export async function destroySession(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && !process.env.E2E,
    path: "/",
    maxAge,
  };
}
