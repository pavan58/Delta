/* Loads the lab library, learning paths and assessments into the database (idempotent). */
import { PrismaClient, Prisma } from "@prisma/client";
import { LABS } from "../src/content/labs";
import { PATHS } from "../src/content/paths";
import { INTERVIEW_QUESTIONS } from "../src/content/paths";

const prisma = new PrismaClient();

export async function seedContent(db: PrismaClient = prisma) {
  for (const l of LABS) {
    const data = {
      title: l.title, difficulty: l.difficulty, category: l.category, objective: l.objective, scenario: l.scenario,
      prerequisites: l.prerequisites as Prisma.InputJsonValue, durationMinutes: l.durationMinutes, expectedOutcome: l.expectedOutcome,
      commands: l.commands as Prisma.InputJsonValue, commonMistakes: l.commonMistakes as Prisma.InputJsonValue, hints: l.hints as Prisma.InputJsonValue,
      solution: l.solution, interviewQuestions: l.interviewQuestions as Prisma.InputJsonValue, checks: l.checks as unknown as Prisma.InputJsonValue, isCapstone: !!l.isCapstone,
    };
    const lab = await db.lab.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...data }, update: data });
    await db.labStep.deleteMany({ where: { labId: lab.id } });
    await db.labStep.createMany({ data: l.steps.map((s, i) => ({ labId: lab.id, order: i + 1, title: s.title, body: s.body })) });
  }
  for (const [pi, p] of PATHS.entries()) {
    const path = await db.learningPath.upsert({ where: { slug: p.slug }, create: { slug: p.slug, title: p.title, description: p.description, level: p.level, order: pi }, update: { title: p.title, description: p.description, level: p.level, order: pi } });
    for (const [mi, m] of p.modules.entries()) {
      const mod = await db.module.upsert({ where: { slug: m.slug }, create: { slug: m.slug, title: m.title, description: m.description, order: mi, pathId: path.id }, update: { title: m.title, description: m.description, order: mi, pathId: path.id } });
      await db.moduleLab.deleteMany({ where: { moduleId: mod.id } });
      for (const [li, slug] of m.labs.entries()) {
        const lab = await db.lab.findUniqueOrThrow({ where: { slug } });
        await db.moduleLab.create({ data: { moduleId: mod.id, labId: lab.id, order: li } });
      }
    }
    const lastModule = await db.module.findUniqueOrThrow({ where: { slug: p.modules[p.modules.length - 1].slug } });
    await db.assessment.upsert({
      where: { slug: `${p.slug}-assessment` },
      create: { slug: `${p.slug}-assessment`, title: `${p.title} - assessment`, questions: p.assessment as unknown as Prisma.InputJsonValue, passMark: 70, moduleId: lastModule.id },
      update: { title: `${p.title} - assessment`, questions: p.assessment as unknown as Prisma.InputJsonValue, moduleId: lastModule.id },
    });
  }
  await db.assessment.upsert({ where: { slug: "mock-interview" }, create: { slug: "mock-interview", title: "Mock technical interview", questions: INTERVIEW_QUESTIONS as unknown as Prisma.InputJsonValue, passMark: 60 }, update: { questions: INTERVIEW_QUESTIONS as unknown as Prisma.InputJsonValue } });
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    if (existing.role !== "ADMIN") await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    return;
  }
  const { registerUser } = await import("../src/lib/auth/users");
  await registerUser({ name: "Azure Gigs Admin", email, password }, { role: "ADMIN" });
  console.log(`Admin user ${email} created.`);
}

if (process.argv[1]?.includes("seed")) {
  seedContent()
    .then(seedAdmin)
    .then(async () => {
      console.log(`Seeded ${LABS.length} labs and ${PATHS.length} learning paths.`);
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
