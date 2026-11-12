"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./client";

interface AuthCtx {
  configured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  role: "user" | "admin";
}

const Ctx = createContext<AuthCtx>({ configured: false, loading: false, user: null, session: null, role: "user" });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthCtx>({ configured: supabaseConfigured, loading: supabaseConfigured, user: null, session: null, role: "user" });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    const loadRole = async (session: Session | null) => {
      let role: "user" | "admin" = "user";
      if (session) {
        const { data } = await sb.from("user_profiles").select("role").eq("id", session.user.id).maybeSingle();
        if (data?.role === "admin") role = "admin";
      }
      if (!cancelled) setState({ configured: true, loading: false, user: session?.user ?? null, session, role });
    };
    sb.auth.getSession().then(({ data }) => loadRole(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      loadRole(session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
