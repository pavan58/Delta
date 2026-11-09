import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Shell user={{ name: user.name, email: user.email, isAdmin: user.role === "ADMIN" }}>{children}</Shell>;
}
