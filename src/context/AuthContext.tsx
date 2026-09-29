"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ID, Models } from "appwrite";
import { account } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const current = await account.get();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { refresh(); }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Route guard
  useEffect(() => {
    if (loading) return;
    const isAuthRoute = pathname === "/login" || pathname === "/signup";
    const verificationRequired = config.requireEmailVerification && user && !user.emailVerification;

    if (verificationRequired) {
      if (pathname !== "/verify") router.replace("/verify");
    } else if (user && (isAuthRoute || pathname === "/verify")) {
      router.replace("/chat");
    } else if (!user && pathname.startsWith("/chat")) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  const signup = async (email: string, password: string, name: string) => {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);

    if (config.requireEmailVerification) {
      try {
        await account.createVerification(`${window.location.origin}/verify`);
      } catch (err) {
        await refresh();
        router.replace("/verify");
        throw err;
      }
      await refresh();
      router.replace("/verify");
      return;
    }

    await refresh();
    router.replace("/chat");
  };

  const login = async (email: string, password: string) => {
    // Clear stale session data before creating new session
    localStorage.removeItem("cookieFallback");
    await account.createEmailPasswordSession(email, password);
    await refresh();
  };

  const resendVerification = async () => {
    if (!user) throw new Error("Sign in before requesting a verification email.");
    if (user.emailVerification) return;
    await account.createVerification(`${window.location.origin}/verify`);
  };

  const logout = async () => {
    try {
      await account.deleteSession("current");
    } catch {
      // ignore if session already expired
    }
    // Clear stale session fallback to prevent 401 on next login
    localStorage.removeItem("cookieFallback");
    setUser(null);
    router.push("/login");
  };

  const updateName = async (name: string) => {
    await account.updateName(name);
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, resendVerification, logout, refresh, updateName }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
