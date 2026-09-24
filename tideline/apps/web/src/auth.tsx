import { createContext, useContext, useState, type ReactNode } from "react";
import type { Session } from "./api";

type Auth = { session: Session | null; setSession: (s: Session | null) => void };
const AuthContext = createContext<Auth | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth provider missing");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setRaw] = useState<Session | null>(() => {
    try {
      const v = sessionStorage.getItem("session");
      return v ? (JSON.parse(v) as Session) : null;
    } catch {
      sessionStorage.removeItem("session");
      return null;
    }
  });
  const setSession = (s: Session | null) => {
    setRaw(s);
    if (s) sessionStorage.setItem("session", JSON.stringify(s));
    else sessionStorage.removeItem("session");
  };
  return <AuthContext.Provider value={{ session, setSession }}>{children}</AuthContext.Provider>;
}
