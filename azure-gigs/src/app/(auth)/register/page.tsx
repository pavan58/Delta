import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm, AuthFrame } from "../auth-form";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function Register() {
  if (await currentUser()) redirect("/home");
  return <AuthFrame title="Create your learner account"><AuthForm mode="register" /></AuthFrame>;
}
