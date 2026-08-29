import { useCallback, useEffect, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };
type AuthUser = { id: number; openId: string; name: string | null; email: string | null; role: "user" | "admin" };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("The authentication service returned an invalid session response.");
      let payload: { user?: AuthUser | null };
      try {
        payload = (await response.json()) as { user?: AuthUser | null };
      } catch {
        throw new Error("The authentication service returned an invalid session response.");
      }
      if (!response.ok) throw new Error("Unable to check the current session.");
      setUser(payload.user ?? null);
      setError(null);
      return payload.user ?? null;
    } catch (requestError) {
      setUser(null);
      setError(requestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleAuthChanged = () => { void refresh(); };
    window.addEventListener("skybet-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("skybet-auth-changed", handleAuthChanged);
  }, [refresh]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setLoading(false);
      try { sessionStorage.removeItem("manus-cookie"); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  return { user, loading, error, isAuthenticated: Boolean(user), refresh, logout };
}
