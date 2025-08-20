import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type Props = {
  role: string | string[];
  children: React.ReactNode;
  fallbackPath?: string;
};

export default function RoleGate({ role, children, fallbackPath = "/access-denied" }: Props) {
  const { user } = useAuth();
  const allowed = Array.isArray(role) ? role.includes(user?.role ?? "") : user?.role === role;
  if (!allowed) return <Navigate to={fallbackPath} replace />;
  return <>{children}</>;
}

