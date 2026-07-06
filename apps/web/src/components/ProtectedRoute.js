import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function ProtectedRoute({ roles, children }) {
    const { user, initializing } = useAuth();
    if (initializing)
        return null;
    if (!user)
        return _jsx(Navigate, { to: "/", replace: true });
    if (user.role === "DEVELOPER")
        return children;
    if (roles && !roles.includes(user.role))
        return _jsx(Navigate, { to: "/", replace: true });
    return children;
}
