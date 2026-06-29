import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "teacher" | "admin" | "super_admin";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  displayName: string | null;
}

const INITIAL: AuthState = {
  loading: true,
  session: null,
  user: null,
  role: null,
  displayName: null,
};

/**
 * Lightweight client-only auth + profile hook.
 * Subscribes to onAuthStateChange once and loads profile/role lazily.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(INITIAL);

  useEffect(() => {
    let active = true;

    const loadExtras = async (user: User | null, session: Session | null) => {
      if (!user) {
        if (active) setState({ loading: false, session: null, user: null, role: null, displayName: null });
        return;
      }
      // defer to avoid deadlock with auth listener
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      const role =
        (roles?.find((r) => r.role === "super_admin")?.role as AppRole) ??
        (roles?.find((r) => r.role === "admin")?.role as AppRole) ??
        (roles?.find((r) => r.role === "teacher")?.role as AppRole) ??
        (roles?.[0]?.role as AppRole) ??
        "student";
      setState({
        loading: false,
        session,
        user,
        role,
        displayName: profile?.display_name ?? user.email ?? null,
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") {
        return;
      }
      // defer fetch out of the callback
      setTimeout(() => void loadExtras(session?.user ?? null, session), 0);
    });

    // initial fetch
    supabase.auth.getSession().then(({ data }) => {
      void loadExtras(data.session?.user ?? null, data.session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
