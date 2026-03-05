import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiGet, apiPost } from "../services/api";
import { getAuth, setAuth, clearAuth, AuthUser } from "../services/auth";

type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean;
  inactivityWarning: boolean;
  extendSession: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getAuth());
  const [initializing, setInitializing] = useState(true);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setInitializing(false);
      return () => {
        active = false;
      };
    }
    apiGet("/auth/session")
      .then((data) => {
        if (!active) return;
        const next: AuthUser = {
          token: user.token,
          role: data.role,
          fullName: data.fullName
        };
        setAuth(next);
        setUser(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearAuth();
          setUser(null);
        }
      })
      .finally(() => {
        if (!active) return;
        setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setInactivityWarning(false);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
      warningTimerRef.current = null;
      logoutTimerRef.current = null;
      return;
    }

    const INACTIVITY_MS = 15 * 60 * 1000;
    const WARNING_MS = INACTIVITY_MS - 60 * 1000;
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

    const clearTimers = () => {
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    };

    const scheduleTimers = () => {
      clearTimers();
      setInactivityWarning(false);
      warningTimerRef.current = window.setTimeout(() => {
        setInactivityWarning(true);
      }, WARNING_MS);
      logoutTimerRef.current = window.setTimeout(() => {
        clearAuth();
        setUser(null);
        setInactivityWarning(false);
      }, INACTIVITY_MS);
    };

    const onActivity = () => scheduleTimers();

    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    scheduleTimers();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      clearTimers();
    };
  }, [user]);

  const extendSession = () => {
    if (!user) return;
    apiPost("/auth/refresh", {})
      .then((data) => {
        const refreshed: AuthUser = {
          token: data.token,
          role: data.role,
          fullName: data.fullName
        };
        setAuth(refreshed);
        setUser(refreshed);
      })
      .catch(() => undefined);

    setInactivityWarning(false);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    const INACTIVITY_MS = 15 * 60 * 1000;
    const WARNING_MS = INACTIVITY_MS - 60 * 1000;
    warningTimerRef.current = window.setTimeout(() => setInactivityWarning(true), WARNING_MS);
    logoutTimerRef.current = window.setTimeout(() => {
      clearAuth();
      setUser(null);
      setInactivityWarning(false);
    }, INACTIVITY_MS);
  };

  const login = async (email: string, password: string) => {
    const data = await apiPost("/auth/login", {
      email: email.trim().toLowerCase(),
      password: password.trim()
    });
    const authUser: AuthUser = { token: data.token, role: data.role, fullName: data.fullName };
    setAuth(authUser);
    setUser(authUser);
    setInitializing(false);
    return authUser;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setInactivityWarning(false);
    setInitializing(false);
  };

  const value = useMemo(
    () => ({ user, initializing, inactivityWarning, extendSession, login, logout }),
    [user, initializing, inactivityWarning]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
