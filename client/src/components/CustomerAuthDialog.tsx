import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CustomerAuthDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; onAuthenticated?: () => void };
type Mode = "login" | "signup";

export function CustomerAuthDialog({ open, onOpenChange, onAuthenticated }: CustomerAuthDialogProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(mode === "signup" ? { email, phone, password, confirmPassword, name } : { email, password }),
      });
      const contentType = response.headers.get("content-type") || "";
      let payload: { error?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          payload = (await response.json()) as { error?: string };
        } catch {
          throw new Error("The authentication service returned an invalid response. Please try again.");
        }
      } else if (!response.ok || contentType.includes("text/html")) {
        throw new Error("The authentication service is temporarily unavailable. Please try again shortly.");
      }
      if (!response.ok) throw new Error(payload.error || "Authentication was unsuccessful.");
      onOpenChange(false);
      window.dispatchEvent(new Event("skybet-auth-changed"));
      onAuthenticated?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication was unsuccessful.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-[var(--sky-blue-100)] bg-white dark:border-white/10 dark:bg-[var(--card)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold text-[var(--sky-navy-950)] dark:text-white">{mode === "login" ? "Welcome back" : "Create your SKYBET account"}</DialogTitle>
          <DialogDescription>{mode === "login" ? "Sign in with your email and password." : "Use your email, Ghana phone number, and a secure password."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && <div className="space-y-2"><Label htmlFor="customer-name">Name (optional)</Label><Input id="customer-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></div>}
          <div className="space-y-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
          {mode === "signup" && <div className="space-y-2"><Label htmlFor="customer-phone">Ghana phone number</Label><Input id="customer-phone" type="tel" inputMode="tel" placeholder="0241234567" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" required /></div>}
          <div className="space-y-2"><Label htmlFor="customer-password">Password</Label><Input id="customer-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></div>
          {mode === "signup" && <div className="space-y-2"><Label htmlFor="customer-confirm-password">Confirm password</Label><Input id="customer-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <Button className="h-11 w-full rounded-xl bg-[var(--sky-blue-600)] font-extrabold text-white hover:bg-[var(--sky-blue-700)]" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
          <button type="button" className="w-full text-sm font-bold text-[var(--sky-blue-700)] hover:underline dark:text-[var(--sky-blue-300)]" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
