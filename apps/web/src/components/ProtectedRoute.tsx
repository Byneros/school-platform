import React from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

type Props = {
  roles?: Array<"ADMIN" | "TEACHER" | "PARENT" | "DEVELOPER">;
  children: React.ReactElement;
};

export default function ProtectedRoute({ roles, children }: Props) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "DEVELOPER") return children;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
