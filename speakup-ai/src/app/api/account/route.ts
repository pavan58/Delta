import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Deletes the signed-in user's account. All user rows are removed by ON DELETE CASCADE. */
export async function DELETE(req: Request) {
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Account deletion is not available on this installation." }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Could not delete account. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
