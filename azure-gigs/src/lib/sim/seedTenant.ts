import { Ctx } from "./engine";
import { prisma } from "@/lib/db";
import { addGroupMember, createGroup, createUser, resolvePrincipal } from "./services/rbac";

/** Creates the Contoso Digital Services directory (people the learner works with) for a new learner. */
export async function seedStarterEnvironment(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ctx: Ctx = { userId, caller: user.email, source: "system" };
  const people = [
    { displayName: "Rahul Sharma", mailNickname: "rahul.sharma", department: "Cloud Engineering", jobTitle: "Senior Azure DevOps Engineer (Mentor)" },
    { displayName: "Priya Nair", mailNickname: "priya.nair", department: "Security", jobTitle: "Cloud Security Engineer" },
    { displayName: "Arjun Mehta", mailNickname: "arjun.mehta", department: "Cloud Operations", jobTitle: "Operations Lead" },
    { displayName: "Sneha Kulkarni", mailNickname: "sneha.kulkarni", department: "Engineering", jobTitle: "Backend Developer" },
    { displayName: "Vikram Rao", mailNickname: "vikram.rao", department: "Change Management", jobTitle: "Change Manager" },
  ];
  for (const p of people) await createUser(ctx, p);
  const ops = await createGroup(ctx, { name: "Cloud Operations", description: "Operations team" });
  const sec = await createGroup(ctx, { name: "Security Team", description: "Security engineering" });
  const devs = await createGroup(ctx, { name: "Developers", description: "Application developers" });
  await addGroupMember(ctx, ops, "arjun.mehta");
  await addGroupMember(ctx, await resolvePrincipal(ctx, "Security Team"), "priya.nair");
  void sec;
  await addGroupMember(ctx, devs, "sneha.kulkarni");
}
