import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const contentType = response.headers.get("content-type") || "";
      let payload: { error?: string; redirectTo?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          payload = await response.json() as { error?: string; redirectTo?: string };
        } catch {
          setError("The administrator sign-in service returned an invalid response. Please try again.");
          return;
        }
      } else {
        setError("The administrator sign-in service is temporarily unavailable. Please try again shortly.");
        return;
      }
      if (!response.ok) {
        setError(payload.error || "Unable to sign in.");
        return;
      }
      window.location.assign(payload.redirectTo || "/admin");
    } catch {
      setError("Unable to reach the administrator sign-in service.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
    <div className="space-y-2"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" autoComplete="username" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>
    <div className="space-y-2"><Label htmlFor="admin-password">Password</Label><div className="relative"><Input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="pr-11" required /><button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div></div>
    {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    <Button type="submit" size="lg" className="w-full shadow-lg transition-all hover:shadow-xl" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
