"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { ID, Models } from "appwrite";
import { account } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  pendingPassword: string | null;
  clearPendingPassword: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  // We hold the password briefly after login/signup so EncryptionContext can use it
  // to derive/unlock without asking the user to enter it again.
  // It is cleared after EncryptionContext consumes it.
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = async () => {
    try {
      const current = await account.get();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard
  useEffect(() => {
    if (loading) return;
    const isAuthRoute = pathname === "/login" || pathname === "/signup";
    if (user && isAuthRoute) {
      router.replace("/chat");
    } else if (!user && pathname === "/chat") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  const signup = async (email: string, password: string, name: string) => {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    if (config.requireEmailVerification) {
      await account.createVerification(`${window.location.origin}/verify`);
    }
    setPendingPassword(password);
    await refresh();
  };

  const login = async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password);
    setPendingPassword(password);
    await refresh();
  };

  const logout = async () => {
    try {
      await account.deleteSession("current");
    } catch {
      // ignore if session already expired
    }
    setPendingPassword(null);
    setUser(null);
    router.push("/login");
  };

  const clearPendingPassword = () => setPendingPassword(null);

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refresh, pendingPassword, clearPendingPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
