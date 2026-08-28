import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = { name: string; email: string; phone: string; password: string; confirmPassword: string };

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues(current => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (values.password.length < 8) return setError("Password must be at least 8 characters.");
    if (values.password !== values.confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(values) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to create your account.");
      window.dispatchEvent(new Event("skybet-auth-changed"));
      setLocation("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,var(--sky-blue-100),transparent_45%),var(--sky-ice-50)] px-4 py-8 dark:bg-[var(--sky-navy-950)]"><Card className="w-full max-w-lg border-[var(--sky-blue-100)] bg-white shadow-[0_24px_70px_rgba(10,63,158,0.12)] dark:border-white/10 dark:bg-[var(--card)]"><CardHeader className="space-y-3 p-6 pb-3 sm:p-8 sm:pb-4"><div className="flex items-center justify-between"><span className="text-lg font-black tracking-[-0.05em] text-[var(--sky-navy-950)] dark:text-white">SKYBET</span><ShieldCheck className="size-5 text-[var(--sky-emerald-600)]" /></div><div><p className="text-xs font-extrabold tracking-[0.14em] text-[var(--sky-blue-600)] uppercase">Join the board</p><CardTitle className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--sky-navy-950)] dark:text-white">Create your account</CardTitle><p className="mt-2 text-sm leading-6 text-[var(--sky-navy-600)] dark:text-slate-400">Set up your SKYBET profile to explore sports, fixtures, and your account workspace.</p></div></CardHeader><CardContent className="p-6 pt-3 sm:p-8 sm:pt-4"><form className="space-y-4" onSubmit={submit}>{([ ["name", "Full name", "Your name", "text"], ["email", "Email address", "you@example.com", "email"], ["phone", "Ghana phone number", "024 000 0000", "tel"] ] as const).map(([field, label, placeholder, type]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{label}</Label><Input id={field} required value={values[field]} onChange={update(field)} placeholder={placeholder} type={type} autoComplete={field === "email" ? "email" : field === "phone" ? "tel" : "name"} /></div>)}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" required minLength={8} value={values.password} onChange={update("password")} type="password" autoComplete="new-password" /></div><div className="space-y-2"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" required value={values.confirmPassword} onChange={update("confirmPassword")} type="password" autoComplete="new-password" /></div></div>{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}<Button type="submit" disabled={submitting} className="h-11 w-full bg-[var(--sky-blue-700)] font-extrabold text-white hover:bg-[var(--sky-blue-800)]">{submitting ? "Creating account..." : "Create account"}<ArrowRight className="size-4" /></Button><p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-[var(--sky-navy-600)] dark:text-slate-400"><LockKeyhole className="size-3.5" /> Your password is securely hashed before storage.</p><p className="text-center text-sm text-[var(--sky-navy-600)] dark:text-slate-400">Already have an account? <Link href="/" className="font-extrabold text-[var(--sky-blue-700)] hover:underline">Go to SKYBET</Link></p></form></CardContent></Card></main>;
}
