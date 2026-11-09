import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { conflict, AppError } from "@/lib/errors";
import { randomUUID } from "node:crypto";
import { seedStarterEnvironment } from "@/lib/sim/seedTenant";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a digit"),
});

export async function registerUser(input: z.infer<typeof registerSchema>, opts: { role?: "LEARNER" | "ADMIN" } = {}) {
  const data = registerSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw conflict("EmailInUse", "An account with this email already exists.");
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: await hashPassword(data.password),
      role: opts.role ?? "LEARNER",
      subscriptions: {
        create: { subscriptionId: randomUUID(), displayName: "Azure Gigs Sandbox (Simulated)" },
      },
    },
  });
  try {
    await seedStarterEnvironment(user.id);
  } catch (e) {
    await prisma.user.delete({ where: { id: user.id } });
    throw e;
  }
  return user;
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export async function authenticate(input: z.infer<typeof loginSchema>) {
  const data = loginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Always run a bcrypt compare to keep timing uniform.
  const ok = await verifyPassword(data.password, user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  if (!user || !ok) throw new AppError(401, "InvalidCredentials", "Invalid email or password.");
  return user;
}

/** Updates streak on daily activity. */
export async function touchActivity(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { lastActiveAt: true, streakDays: true } });
  if (!u) return;
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const diff = day(new Date()) - day(u.lastActiveAt);
  if (diff === 0 && u.streakDays > 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date(), streakDays: diff === 1 ? u.streakDays + 1 : diff === 0 ? Math.max(1, u.streakDays) : 1 },
  });
}
