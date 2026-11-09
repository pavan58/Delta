import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { TYPE_LABELS } from "@/lib/sim/types";
import { LABS } from "@/content/labs";
import { NAV } from "@/components/nav";

export const GET = withUser(async (req, { user }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return { results: [] };
  const resources = await prisma.simulatedResource.findMany({ where: { userId: user.id, nameKey: { contains: q } }, take: 8 });
  return {
    results: [
      ...NAV.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 5).map((n) => ({ kind: "Service", label: n.label, href: n.href })),
      ...resources.map((r) => ({ kind: TYPE_LABELS[r.type] ?? r.type, label: r.name, href: `/resources/${r.id}` })),
      ...LABS.filter((l) => l.title.toLowerCase().includes(q)).slice(0, 5).map((l) => ({ kind: "Lab", label: l.title, href: `/labs/${l.slug}` })),
    ],
  };
});
