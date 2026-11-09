import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Administration" };

/** Platform administration (role ADMIN only). Learners receive a 404 so the page's existence is not revealed. */
export default async function Admin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") notFound();
  const [users, resources, submissions, passed, incidents, certs, audit, recentUsers] = await Promise.all([
    prisma.user.count(), prisma.simulatedResource.count(), prisma.labSubmission.count(), prisma.labScore.count({ where: { passed: true } }),
    prisma.incident.count(), prisma.certificate.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { email: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { email: true, name: true, role: true, createdAt: true, lastActiveAt: true } }),
  ]);
  const stats: [string, number][] = [["Learners", users], ["Simulated resources", resources], ["Lab submissions", submissions], ["Passed submissions", passed], ["Incidents", incidents], ["Certificates", certs]];
  return (
    <>
      <PageHeader title="Administration" subtitle="Platform health and security audit trail." crumbs={[{ label: "Administration" }]} />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">{stats.map(([k, v]) => <Card key={k} className="p-4"><p className="text-xs text-muted">{k}</p><p className="text-2xl font-semibold">{v}</p></Card>)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Recent learners" /><Table><thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Joined</Th><Th>Last active</Th></tr></thead><tbody>{recentUsers.map((u) => <tr key={u.email}><Td>{u.name}</Td><Td>{u.email}</Td><Td>{u.role}</Td><Td>{timeAgo(u.createdAt)}</Td><Td>{timeAgo(u.lastActiveAt)}</Td></tr>)}</tbody></Table></Card>
        <Card><CardHeader title="Security audit log" /><Table><thead><tr><Th>When</Th><Th>Action</Th><Th>User</Th><Th>IP</Th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><Td>{timeAgo(a.createdAt)}</Td><Td>{a.action}</Td><Td>{a.user?.email ?? "-"}</Td><Td>{a.ip ?? "-"}</Td></tr>)}</tbody></Table></Card>
      </div>
    </>
  );
}
