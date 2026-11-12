import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Number of people who signed up with the current user's referral code. */
export async function GET(req: Request) {
  const db = adminClient();
  const user = await userFromRequest(req);
  if (!db || !user) return NextResponse.json({ count: null });
  const { data: prof } = await db.from("user_profiles").select("referral_code").eq("id", user.id).maybeSingle();
  if (!prof?.referral_code) return NextResponse.json({ count: 0 });
  const { count } = await db.from("referrals").select("referred_user_id", { count: "exact", head: true }).eq("referrer_code", prof.referral_code);
  return NextResponse.json({ count: count ?? 0 });
}
