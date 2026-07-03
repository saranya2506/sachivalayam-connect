import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "government_authority" | "admin" | "officer" | "citizen";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

// Retry loading role up to 3 times with increasing delay (handles DB trigger timing)
async function loadRoleWithRetry(uid: string): Promise<AppRole | null> {
  const delays = [0, 800, 2000];
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (data && data.length > 0) {
      const order: AppRole[] = ["government_authority", "admin", "officer", "citizen"];
      const found = order.find((r) => data.some((d) => d.role === r));
      if (found) return found;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      const r = await loadRoleWithRetry(data.session.user.id);
      setRole(r);
    } else {
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Use setTimeout to avoid Supabase deadlock during auth state change
        setTimeout(async () => {
          const r = await loadRoleWithRetry(sess.user.id);
          setRole(r);
        }, 0);
      } else {
        setRole(null);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        setLoading(false);
      }
    });
    refresh();
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthCtx.Provider value={{ user, session, role, loading, refresh, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function roleHome(role: AppRole | null): string {
  switch (role) {
    case "government_authority": return "/authority";
    case "admin": return "/admin";
    case "officer": return "/officer";
    case "citizen": return "/citizen";
    default: return "/auth";
  }
}
