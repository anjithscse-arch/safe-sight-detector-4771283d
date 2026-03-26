import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, type User } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshUser = async () => {
      const current = await getCurrentUser();
      setUser(current);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          username: session.user.user_metadata?.username || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
        });
      } else {
        // Covers local fallback auth session when Supabase has no active session.
        void refreshUser();
      }
      setLoading(false);
    });

    const onLocalAuthChanged = () => {
      void refreshUser();
    };

    window.addEventListener("auth-changed", onLocalAuthChanged);

    void refreshUser();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("auth-changed", onLocalAuthChanged);
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
