import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] animate-fade-up flex-col items-center justify-center gap-3" role="status">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-sage-700" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-secondary">Opening your room…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
