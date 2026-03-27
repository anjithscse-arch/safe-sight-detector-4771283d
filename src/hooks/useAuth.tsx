import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
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

    const onLocalAuthChanged = () => {
      void refreshUser();
    };

    window.addEventListener("auth-changed", onLocalAuthChanged);

    void refreshUser();

    return () => {
      window.removeEventListener("auth-changed", onLocalAuthChanged);
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
