import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const serverSupabaseConfigured = Boolean(url && anon);

let admin: SupabaseClient | null = null;
/** Service-role client: bypasses RLS. Use ONLY after server-side authorisation checks. */
export function adminClient(): SupabaseClient | null {
  if (!url || !service) return null;
  if (!admin) admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Verifies the bearer token sent by the browser and returns the user (or null). */
export async function userFromRequest(req: Request): Promise<User | null> {
  if (!url || !anon) return null;
  const h = req.headers.get("authorization");
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
}

/** Server-side role check: role is read with the service key from user_profiles (users cannot change it - see RLS). */
export async function requireAdmin(req: Request): Promise<{ user: User; db: SupabaseClient } | { error: string; status: number }> {
  const db = adminClient();
  if (!db) return { error: "Admin requires Supabase with SUPABASE_SERVICE_ROLE_KEY configured.", status: 503 };
  const user = await userFromRequest(req);
  if (!user) return { error: "Sign in required.", status: 401 };
  const { data } = await db.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") return { error: "Admin access only.", status: 403 };
  return { user, db };
}
