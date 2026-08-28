import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: "user" | "admin";
};

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[var(--sky-ice-50)] text-sm font-bold text-[var(--sky-navy-600)]">Checking your session...</div>;
  }

  if (!user) return <Redirect to="/signup" />;
  if (requiredRole && user.role !== requiredRole) return <Redirect to="/" />;
  return <>{children}</>;
}
