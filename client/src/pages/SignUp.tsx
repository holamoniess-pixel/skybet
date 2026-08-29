import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = { name: string; email: string; phone: string; password: string; confirmPassword: string; referralCode: string };

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", phone: "", password: "", confirmPassword: "", referralCode: typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() ?? "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  const update = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues(current => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (values.password.length < 8) return setError("Password must be at least 8 characters.");
    if (mode === "signup" && values.password !== values.confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "include", body: JSON.stringify(mode === "signup" ? values : { email: values.email, password: values.password }) });
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
      if (!response.ok) throw new Error(payload.error ?? "Authentication was unsuccessful.");
      window.dispatchEvent(new Event("skybet-auth-changed"));
      setLocation("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,var(--sky-blue-100),transparent_45%),var(--sky-ice-50)] px-4 py-8 dark:bg-[var(--sky-navy-950)]">
      <Card className="w-full max-w-lg border-[var(--sky-blue-100)] bg-white shadow-[0_24px_70px_rgba(10,63,158,0.12)] dark:border-white/10 dark:bg-[var(--card)]">
        <CardHeader className="space-y-3 p-6 pb-3 sm:p-8 sm:pb-4">
          <div className="flex items-center justify-between"><span className="text-lg font-black tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">SKYBET</span><ShieldCheck className="size-5 text-[var(--sky-emerald-600)]" /></div>
          <div><p className="text-xs font-extrabold tracking-[0.14em] text-[var(--sky-blue-600)] uppercase">{isSignup ? "Join the board" : "Welcome back"}</p><CardTitle className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--sky-navy-950)] dark:text-white">{isSignup ? "Create your account" : "Sign in to SKYBET"}</CardTitle><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">{isSignup ? "Set up your SKYBET profile to explore sports, fixtures, and your account workspace." : "Use your existing email and password from any device."}</p></div>
        </CardHeader>
        <CardContent className="p-6 pt-3 sm:p-8 sm:pt-4">
          <form className="space-y-4" onSubmit={submit}>
            {isSignup ? <>
              {([ ["name", "Full name", "Your name", "text"], ["email", "Email address", "you@example.com", "email"], ["phone", "Ghana phone number", "024 000 0000", "tel"] ] as const).map(([field, label, placeholder, type]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{label}</Label><Input id={field} required value={values[field]} onChange={update(field)} placeholder={placeholder} type={type} autoComplete={field === "email" ? "email" : field === "phone" ? "tel" : "name"} /></div>)}
              <div className="space-y-2"><Label htmlFor="referralCode">Referral code (optional)</Label><Input id="referralCode" value={values.referralCode} onChange={update("referralCode")} placeholder="Enter a referral code" autoComplete="off" /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" required minLength={8} value={values.password} onChange={update("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--sky-navy-600)] transition-colors hover:text-[var(--sky-blue-700)]" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div></div>
              <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm password</Label><div className="relative"><Input id="confirmPassword" required value={values.confirmPassword} onChange={update("confirmPassword")} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--sky-navy-600)] transition-colors hover:text-[var(--sky-blue-700)]" onClick={() => setShowConfirmPassword(current => !current)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div></div>
            </> : <>
              <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" required value={values.email} onChange={update("email")} type="email" autoComplete="email" /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" required minLength={8} value={values.password} onChange={update("password")} type={showPassword ? "text" : "password"} autoComplete="current-password" className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--sky-navy-600)] transition-colors hover:text-[var(--sky-blue-700)]" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div></div>
            </>}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <Button type="submit" disabled={submitting} className="h-11 w-full bg-[var(--sky-blue-700)] font-extrabold text-white hover:bg-[var(--sky-blue-800)]">{submitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}<ArrowRight className="size-4" /></Button>
            {isSignup && <p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400"><LockKeyhole className="size-3.5" /> Your password is securely hashed before storage.</p>}
            <p className="text-center text-sm text-[var(--sky-navy-600)] dark:text-slate-400">{isSignup ? "Already have an account?" : "New to SKYBET?"} <button type="button" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }} className="font-extrabold text-[var(--sky-blue-700)] hover:underline">{isSignup ? "Sign in" : "Create an account"}</button></p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
