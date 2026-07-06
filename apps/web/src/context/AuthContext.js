import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiGet, apiPost, clearDeveloperAccessToken } from "../services/api";
import { getAuth, setAuth, clearAuth } from "../services/auth";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getAuth());
    const [initializing, setInitializing] = useState(true);
    const [inactivityWarning, setInactivityWarning] = useState(false);
    const warningTimerRef = useRef(null);
    const logoutTimerRef = useRef(null);
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
            if (!active)
                return;
            const next = {
                token: user.token,
                role: data.role,
                fullName: data.fullName
            };
            setAuth(next);
            setUser(next);
        })
            .catch((error) => {
            if (!active)
                return;
            if (error instanceof ApiError && error.status === 401) {
                clearAuth();
                setUser(null);
            }
        })
            .finally(() => {
            if (!active)
                return;
            setInitializing(false);
        });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        if (!user) {
            setInactivityWarning(false);
            if (warningTimerRef.current)
                window.clearTimeout(warningTimerRef.current);
            if (logoutTimerRef.current)
                window.clearTimeout(logoutTimerRef.current);
            warningTimerRef.current = null;
            logoutTimerRef.current = null;
            return;
        }
        const INACTIVITY_MS = 15 * 60 * 1000;
        const WARNING_MS = INACTIVITY_MS - 60 * 1000;
        const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
        const clearTimers = () => {
            if (warningTimerRef.current)
                window.clearTimeout(warningTimerRef.current);
            if (logoutTimerRef.current)
                window.clearTimeout(logoutTimerRef.current);
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
        if (!user)
            return;
        apiPost("/auth/refresh", {})
            .then((data) => {
            const refreshed = {
                token: data.token,
                role: data.role,
                fullName: data.fullName
            };
            setAuth(refreshed);
            setUser(refreshed);
        })
            .catch(() => undefined);
        setInactivityWarning(false);
        if (warningTimerRef.current)
            window.clearTimeout(warningTimerRef.current);
        if (logoutTimerRef.current)
            window.clearTimeout(logoutTimerRef.current);
        const INACTIVITY_MS = 15 * 60 * 1000;
        const WARNING_MS = INACTIVITY_MS - 60 * 1000;
        warningTimerRef.current = window.setTimeout(() => setInactivityWarning(true), WARNING_MS);
        logoutTimerRef.current = window.setTimeout(() => {
            clearAuth();
            setUser(null);
            setInactivityWarning(false);
        }, INACTIVITY_MS);
    };
    const login = async (email, password) => {
        const data = await apiPost("/auth/login", {
            email: email.trim().toLowerCase(),
            password: password.trim()
        });
        if (data?.requiresTwoFactor) {
            return {
                status: "2fa",
                token: data.twoFactorToken,
                email: data.email,
                role: data.role,
                expiresAt: data.expiresAt,
                devCode: data.devCode
            };
        }
        const authUser = { token: data.token, role: data.role, fullName: data.fullName };
        setAuth(authUser);
        setUser(authUser);
        setInitializing(false);
        return { status: "ok", user: authUser };
    };
    const verifyTwoFactor = async (token, code) => {
        const data = await apiPost("/auth/2fa/verify", {
            token,
            code: code.trim()
        });
        const authUser = { token: data.token, role: data.role, fullName: data.fullName };
        setAuth(authUser);
        setUser(authUser);
        setInitializing(false);
        return authUser;
    };
    const resendTwoFactor = async (token) => apiPost("/auth/2fa/resend", { token });
    const logout = () => {
        apiPost("/auth/logout", {}).catch(() => undefined);
        clearDeveloperAccessToken();
        clearAuth();
        setUser(null);
        setInactivityWarning(false);
        setInitializing(false);
    };
    const value = useMemo(() => ({
        user,
        initializing,
        inactivityWarning,
        extendSession,
        login,
        verifyTwoFactor,
        resendTwoFactor,
        logout
    }), [user, initializing, inactivityWarning]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("AuthProvider missing");
    return ctx;
}
