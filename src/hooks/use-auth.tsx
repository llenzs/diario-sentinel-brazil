import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Provisiona perfil + papel no servidor (idempotente) a cada sessão nova
    const provision = (s: Session | null) => {
      if (!s) return;
      supabase.rpc("ensure_my_profile").then(({ error }) => {
        if (error) console.error("[auth] ensure_my_profile failed", error);
      });
    };

    // IMPORTANT: subscribe BEFORE getSession to avoid missed events
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        provision(newSession);
      }
    });


    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[auth] getSession failed", err);
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    // Safety net: never leave the UI stuck on "Carregando..." if Supabase
    // never responds (e.g. preview proxy interfering with fetch).
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setLoading((prev) => (prev ? false : prev));
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
