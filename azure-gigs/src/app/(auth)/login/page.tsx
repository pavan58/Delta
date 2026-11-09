import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { AuthForm, AuthFrame } from "../auth-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function Login() {
  if (await currentUser()) redirect("/home");
  return <AuthFrame title="Sign in"><AuthForm mode="login" /></AuthFrame>;
}
